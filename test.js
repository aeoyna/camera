console.log("Node is working!");
try {
    const fs = require('fs');
    console.log("FS is working");
    if (fs.existsSync('server.pfx')) console.log("PFX exists");
} catch (e) {
    console.error(e);
}
