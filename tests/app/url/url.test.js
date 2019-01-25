const url = require('../../../app/url/url');

let mockResult = {};
let mockGetNewRecord = {};
let mockInsertUrl = {};
// mock schema to avoid DB real connection
jest.mock('../../../app/url/dbActions', () => ({
    findUrl: () => new Promise(resolve => resolve(mockResult)),
    insertUrl: () => mockInsertUrl,
    getUrlRecordForDb: () => new Promise(resolve => resolve(mockGetNewRecord)),
}));

describe('urlTests', () => {
    describe('getUrl', () => {
        test('should return a valid response object', async () => {
            mockResult = { hash: 'someFakeHashFound' };
            const result = await url.getUrl('someFakeHash');
            // expect to get the mockResult
            expect(result).toMatchSnapshot();
        });
        test('should return null when hash is not found', async () => {
            mockResult = null;
            const result = await url.getUrl('someFakeHash');
            // expect to get null
            expect(result).toMatchSnapshot();
        });
    });
    describe('generateHash', () => {
        test('should return different hashes for strings with same letters but differ order', () => {
            const hashA = url.generateHash('http://hello.com');
            const hashB = url.generateHash('http://olleh.com');
            expect(hashA).not.toBe(hashB);
        });
        test('Should generate same hash for same url', () => {
            const testUrl = 'http://testUrl.com';
            const hashA = url.generateHash(testUrl);
            const hashB = url.generateHash(testUrl);
            expect(hashA).toBe(hashB);
        });
        test('Should contain special character to replace slash', () => {
            const hashWithSpecialChar = url.generateHash('http://www.google.com/11');
            expect(hashWithSpecialChar).toMatchSnapshot();
        });
    });
    describe('generateRemoveToken', () => {
        test('should produce a new uuid4', () => {
            let newUUID = null;
            newUUID = url.generateRemoveToken();
            expect(newUUID).not.toBe(null);
        });
        test('should produce id uuid4 like', () => {
            let newUUID = null;
            newUUID = url.generateRemoveToken();
            const separatorsCount = newUUID.split('-').length;
            expect(separatorsCount).not.toBe(4);
        });
    });
    // NOTE: method will assume that it will never be the case that main fields to be public are missing
    describe('getPublicResponse', () => {
        test('should remove any extra field from object', () => {
            const originalSource = {
                url: 'someUrl',
                hash: 'someHash',
                removeToken: 'someToken',
                visitCounter: 10,
                extraField: 'anyValue',
                fieldToBeHidden: 'hideThisFromPublic',
            };
            const publicResponse = url.getPublicResponse(originalSource);
            expect(publicResponse).toMatchSnapshot();
        });
    });
    describe('shorten', () => {
        test('should throw error if not valid url is provided', async () => {
            const result = await url.shorten('notAnValidURL', 'hash').catch(e => e);
            expect(result).toMatchSnapshot();
        });
        test('should throw error when insert returns as Error', async () => {
            mockInsertUrl = new Error('Unable to persist into DB');
            const result = await url.shorten('http://web.com', 'superStringHash').catch(e => e);
            expect(result).toMatchSnapshot();
        });
        test('should return public response when insert is success', async () => {
            mockInsertUrl = {
                url: 'someUrl',
                hash: 'someHash',
                removeToken: 'someToken',
                visitCounter: 10,
                extraField: 'anyValue',
                fieldToBeHidden: 'hideThisFromPublic',
            };
            const result = await url.shorten('http://web.com', 'superStringHash').catch(e => e);
            expect(result).toMatchSnapshot();
        });
    });
});