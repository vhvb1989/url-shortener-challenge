/**
 * This is a module for wrapping DB functions and be able to mock this for unit testing
 */
const UrlModel= require('./schema');

const findUrl = async hash => UrlModel.findOne({ hash });

const addVisitCounter = async source => UrlModel
    .findOneAndUpdate({ 'hash': source.hash }, { $set: { 'visitCounter': source.visitCounter + 1 }}, { new: true })
    .catch(() => null);

const reenableUrl = async (source, removeToken) => UrlModel
    .findOneAndUpdate(
        { 'hash': source.hash },
        { $set: { 'active': true, createdAt: Date.now(), visitCounter: 1, removeToken }},
        { new: true }
    )
    .catch(() => null);

const disableUrl = async source => UrlModel
    .updateOne({ 'hash': source.hash }, { $set: { 'active': false, removedAt: Date.now() }})
    .catch(() => null);

const getUrlRecordForDb = async ({
    url,
    protocol,
    domain,
    path,
    hash,
    removeToken,
  }) => new UrlModel({
        url,
        protocol,
        domain,
        path,
        hash,
        isCustom: false,
        removeToken,
        active: true
      });

const insertUrl = async urlDbRecord => urlDbRecord.save().catch(e => {
        return new Error('Unable to persist into DB', e);
      });

module.exports = {
    findUrl,
    addVisitCounter,
    reenableUrl,
    disableUrl,
    insertUrl,
    getUrlRecordForDb,
}
