var express = require('express');
var app = express();

app.use(express.static(__dirname + '/public'));

var port = process.env.PORT || 3000;
app.listen(port);

console.log('Express app listening on port ' + port.toString());
console.log('Navigate your browser to http://localhost:3000/index.html to get started.');