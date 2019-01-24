const uuidv4 = require('uuid/v4');
const hash = require('object-hash');
const { domain } = require('../../environment');
const SERVER = `${domain.protocol}://${domain.host}`;

const UrlModel= require('./schema');
const parseUrl = require('url').parse;
const validUrl = require('valid-url');

const HASHING_ALGORITH = 'md5';
const ENCODING = 'base64'

/**
 * Lookup for existent, active shortened URLs by hash.
 * 'null' will be returned when no matches were found.
 * @param {string} hash
 * @returns {object}
 */
async function getUrl(hash) {
  let source = await UrlModel.findOne({ hash });
  return source;
}

/**
 * Generate an unique hash-ish- for an URL.
 * Using library object-hash from network: https://www.npmjs.com/package/object-hash
 * It will ensure unique hash per project is created and encoded with base64 to have fixed length
 * @param {string} id
 * @returns {string} hash
 */
function generateHash(url) {
  const urlHash = hash(url, { algorithm: HASHING_ALGORITH, encoding: ENCODING });
  // swap any `/` char for `-` to avoid crashing url parameters
  return urlHash.replace('/','-');
}

/**
 * Generate a random token that will allow URLs to be (logical) removed
 * @returns {string} uuid v4
 */
function generateRemoveToken() {
  return uuidv4();
}

/**
 * Wraps a public response for after creating and for querying
 */
function getPublicResponse({url, hash, removeToken, visitCounter}) {
  return {
    url,
    shorten: `${SERVER}/${hash}`,
    hash,
    removeUrl: `${SERVER}/${hash}/remove/${removeToken}`,
    visits: `${visitCounter} visits recorded`,
  };
}

/**
 * Create an instance of a shortened URL in the DB.
 * Parse the URL destructuring into base components (Protocol, Host, Path).
 * An Error will be thrown if the URL is not valid or saving fails.
 * @param {string} url
 * @param {string} hash
 * @returns {object}
 */
async function shorten(url, hash) {

  if (!isValid(url)) {
    throw new Error('Invalid URL');
  }

  // Get URL components for metrics sake
  const urlComponents = parseUrl(url);
  const protocol = urlComponents.protocol || '';
  const domain = `${urlComponents.host || ''}${urlComponents.auth || ''}`;
  const path = `${urlComponents.path || ''}${urlComponents.hash || ''}`;

  // Generate a token that will alow an URL to be removed (logical)
  const removeToken = generateRemoveToken();

  // Create a new model instance
  const shortUrl = new UrlModel({
    url,
    protocol,
    domain,
    path,
    hash,
    isCustom: false,
    removeToken,
    active: true
  });

  const saved = await shortUrl.save().catch(e => {
    if (e.code === 11000) {
      // duplicated key, db already has this hash, just return it
      return true;
    }
    return new Error('Unable to persist into DB', e);
  });

  if (saved instanceof Error) {
    throw saved;
  }

  return getPublicResponse(saved);
}

/**
 * Validate URI
 * @param {any} url
 * @returns {boolean}
 */
function isValid(url) {
  return validUrl.isUri(url);
}

/**
 * Register a visit for this url
 */
async function registerVisit(source) {
  const updatedSource = await UrlModel
  .findOneAndUpdate({ 'hash': source.hash }, { $set: { 'visitCounter': source.visitCounter + 1 }}, { new: true })
  .catch(() => null);

  return updatedSource;
}

/**
 * Mark url as deleted
 */
async function deleteUrl(source) {
    const updatedSource = await UrlModel
      .updateOne({ 'hash': source.hash }, { $set: { 'active': false, removedAt: Date.now() }})
      .catch(() => null);

    return updatedSource;
}

/**
 * Mark url as active again
 */
async function enableUrl(source) {
  // Generate a new token for removing
  const updatedSource = await UrlModel
    .findOneAndUpdate(
      { 'hash': source.hash },
      { $set: { 'active': true, createdAt: Date.now(), visitCounter: 1, removeToken: generateRemoveToken() }},
      { new: true }
    )
    .catch(() => null);

  return getPublicResponse(updatedSource);
}

module.exports = {
  shorten,
  getUrl,
  generateHash,
  generateRemoveToken,
  isValid,
  getPublicResponse,
  registerVisit,
  deleteUrl,
  enableUrl,
}
