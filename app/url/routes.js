const router = require('express').Router();
const url = require('./url');

const getError = (code, message) => {
  const error = new Error(message);
  error.status = code;
  return error;
}

const notFound = () => getError(404, 'Not Found. Provided hash does not exists');

const invalidToken = () => getError(400, 'Bad Request. token is invalid');

const missingBodyParameter = (...args) => getError(400, `Bad Request. Missing ${args.join(', ')} in body parameter`);

const unableToDelete = () => getError(500, 'Unable to delete url. maybe try later');

const missingUrl = () => missingBodyParameter('url');

const missingHashAndOrToken = () => missingBodyParameter('hash', 'or', 'token');

const missingHash = () => missingBodyParameter('hash');

router.get('/:hash', async (req, res, next) => {

  if (!req.params || !req.params.hash) {
    return next(missingHash());
  }

  const source = await url.getUrl(req.params.hash);

  // Respond accordingly when the hash wasn't found (404 maybe?)
  if (!source || !source.active) {
    return next(notFound());
  }

  // TODO: Register visit
  const updatedSource = await url.registerVisit(source);

  // Hide fields that shouldn't be public
  const publicSource = url.getPublicResponse(updatedSource);


  // Behave based on the requested format using the 'Accept' header.
  // If header is not provided or is */* redirect instead.
  const accepts = req.get('Accept');

  switch (accepts) {
    case 'text/plain':
      res.end(updatedSource.url);
      break;
    case 'application/json':
      res.json(publicSource);
      break;
    default:
      res.redirect(updatedSource.url);
      break;
  }
});

router.post('/', async (req, res, next) => {
  // Validate 'req.body.url' presence
  if (!req.body || !req.body.url) {
    return next(missingUrl());
  }

  try {
    const hash = url.generateHash(req.body.url);
    const source = await url.getUrl(hash);
    let shortUrl;
    if (!source) {
      // Add a new url to DB
      shortUrl = await url.shorten(req.body.url, hash);
    } else if (!source.active) {
      // Tried to add url that was previously deleted, just enable it
      shortUrl = await url.enableUrl(source);
    } else {
      // Tried to add an existing url, return the one in DB only
      shortUrl = url.getPublicResponse(source);
    }
    res.json(shortUrl);
  } catch (e) {
    // Personalized Error Messages
    next(e);
  }
});


router.delete('/:hash/remove/:removeToken', async (req, res, next) => {
  if (!req.params || !req.params.hash || !req.params.removeToken) {
    return next(missingHashAndOrToken());
  }
  // Remove shortened URL if the remove token and the hash match
  const source = await url.getUrl(req.params.hash);
  if (!source || !source.active) {
    return next(notFound());
  }

  if (source.removeToken !== req.params.removeToken) {
    return next(invalidToken());
  }

  const deleted = url.deleteUrl(source);

  if (!deleted) {
    return next(unableToDelete());
  }

  // Will disable url.  then if in the future we try to add it again, we will just enabled and update date
  return res.end('ok. Deleted');
});

module.exports = router;
