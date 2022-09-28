No local modules aside of main `serverlessSdk` object should be required in context of this directory

When relying on `serverlessSdk`, require it as:

```javascript
const serverlessSdk = global.serverlessSdk || require('../../');
```
