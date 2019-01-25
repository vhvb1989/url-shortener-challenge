const uuidv4 = require('uuid/v4');
const hash = require('object-hash');
const { domain, app } = require('../../environment');
const SERVER = `${domain.protocol}://${domain.host}`;

const { findUrl, addVisitCounter, disableUrl, insertUrl, getUrlRecordForDb, reenableUrl } = require('./dbActions');
const parseUrl = require('url').parse;
const validUrl = require('valid-url');

const HASHING_ALGORITH = 'md5';
const ENCODING = 'base64';

/**
 * **********  Dictionary state (in-memory only) for custom shorting implementation
 * TODO: Move Counters and map to DB to persist the zookeeper
 */
const DOMAIN_MAP = new Map();
let DOMAIN_COUNTER = 10; // we use Hex, so 10 would be start with a
const PROTOCOL_MAP = new Map();
let PROTOCOL_COUNTER = 10;  // Counters are used to keep the next ID to use for a new HASH
const PATH_MAP = new Map();
let PATH_COUNTER = 10;
const COMPONENTS = {
  DOMAIN: 1, PROTOCOL: 2, PATH: 3
};

const getCounter = component => {
  switch(component) {
    case COMPONENTS.DOMAIN:
      return DOMAIN_COUNTER;
    case COMPONENTS.PATH:
      return PATH_COUNTER;
    case COMPONENTS.PROTOCOL:
      return PROTOCOL_COUNTER;
  }
}
const incrementCounter = component => {
  switch(component) {
    case COMPONENTS.DOMAIN:
      DOMAIN_COUNTER += 1;
      return;
    case COMPONENTS.PATH:
      PATH_COUNTER += 1;
      return;
    case COMPONENTS.PROTOCOL:
      PROTOCOL_COUNTER += 1;
      return;
  }
}

const getUrlComponents = url => {
  // Get URL components for metrics sake
  const urlComponents = parseUrl(url);
  const protocol = urlComponents.protocol || '';
  const domain = `${urlComponents.host || ''}${urlComponents.auth || ''}`;
  const path = `${urlComponents.path || ''}${urlComponents.hash || ''}`;
  return ({ protocol, domain, path });
};

const getHashFromMap = (map, key, component) => {
  // get the hash of the key
  const keyHash = hash(key);

  // see if it is already in map
  if (map.has(keyHash)) {
    return map.get(keyHash);
  }

  // create new key for element with a hash
  const currentKey = getCounter(component).toString(16);
  map.set(keyHash, currentKey);
  incrementCounter(component);
  return currentKey;
}

const customHash = (url) => {
  const { protocol, domain, path } = getUrlComponents(url);
  const protocolId = getHashFromMap(PROTOCOL_MAP, protocol, COMPONENTS.PROTOCOL);
  const domainId = getHashFromMap(DOMAIN_MAP, domain, COMPONENTS.DOMAIN);
  const pathId = getHashFromMap(PATH_MAP, path, COMPONENTS.PATH);
  return `${protocolId}${domainId}${pathId}`;
};

/**
 * Lookup for existent, active shortened URLs by hash.
 * 'null' will be returned when no matches were found.
 * @param {string} hash
 * @returns {object}
 */
async function getUrl(hash) {
  let source = await findUrl(hash);
  return source;
}

/**
 * Generate an unique hash-ish- for an URL.
 * Using library object-hash from network: https://www.npmjs.com/package/object-hash
 * It will ensure unique hash per project is created and encoded with base64 to have fixed length
 * @param {string} id
 * @param {boolean} customMethod default to false if nothing is set up from env. It can be called with tru to had override (testing purposes)
 * @returns {string} hash
 */
function generateHash(url, customMethod = app.CUSTOM_IMPLEMENTATION || false) {
  let urlHash;
  if (customMethod) {
    urlHash = customHash(url);
  } else {
    // swap any `/` char for `-` to avoid crashing url parameters
    urlHash = hash(url, { algorithm: HASHING_ALGORITH, encoding: ENCODING }).replace('/','-');
  }
  return urlHash;
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
  const { protocol, domain, path } = getUrlComponents(url);

  // Generate a token that will alow an URL to be removed (logical)
  const removeToken = generateRemoveToken();

  // Create a new model instance
  const newUrlDbRecord = await getUrlRecordForDb({
    url,
    protocol,
    domain,
    path,
    hash,
    removeToken,
  });

  const saved = await insertUrl(newUrlDbRecord);

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
  const updatedSource = await addVisitCounter(source);
  return updatedSource;
}

/**
 * Mark url as deleted
 */
async function deleteUrl(source) {
    const updatedSource = await disableUrl(source);
    return updatedSource;
}

/**
 * Mark url as active again
 */
async function enableUrl(source) {
  // Generate a new token for removing
  const updatedSource = await reenableUrl(source, generateRemoveToken());
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
