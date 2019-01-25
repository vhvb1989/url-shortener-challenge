# URL Shortener Challenge

## Implementation
url module: Containing two ways of shortening a url (with 3rd party and custom)

### 3rd party Implementation
Uses an external library `object-hash` to get hash out of any url using md5.
Then the hash is encoded with base64 to get a fixed size hash
And at the end, any non supported character is replaced from base64 and swapped for a valid character.
#### PROS
- no need to maintain the hashing Implementation.
- based on md5, hashing ensures minimum collision rate.
- For super long urls, this method will always ensure fixed size urls as output
- No need to use DB for keeping extra hashing configuration options
#### CONS
- Hash will be longer than input for urls that are short (ie http://www.some.com/123212?a=1)
- Solution is not as original as an in-house Implementation

### Custom Implementation
Server keep internal state to generate HEX ids for each url's element
Then, joining all ids will generate a king of hash
This brings the option of reusing url's elements (like protocol and domains)
So, when getting a hash for http://www.google.com/something and http://www.google.com/something2
if protocol (http) id is `1`
And domain (google.com) id is `1`
And path (something, something2) are ids `1` and `2`
It would be producing hash `111` for url1 and `112` for url2
It wouldn't be required to create more keys for the recorded domains
#### PROS
- Super shortening for urls for the first many thousands urls recorded
- Original as in-house Implementation
#### CONS
- Still make use of md5 hashing as dictionary keys
- Currently is implemented as server state only. So, as soon as server goes down, the dictionaries are lost

> ## Notes
> - Persisting dictionaries for custom Implementation is not added as part of current release

## Supported npm scripts
```javascript
npm test  // runs eslint check and unit tests
npm start // launch server with default 3rd party implementation
npm run customImplementation // launch server with custom in-house implementation
```
