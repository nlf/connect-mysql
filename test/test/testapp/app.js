var express = require('express');
var session = require('express-session')
var path = require('path');
var favicon = require('serve-favicon');
var logger = require('morgan');
var cookieParser = require('cookie-parser');
var bodyParser = require('body-parser');
var fs = require('fs'); 
var options = { 
    key: fs.readFileSync('encryption/server-key.pem'), 
    cert: fs.readFileSync('encryption/server-crt.pem'), 
    ca: fs.readFileSync('encryption/ca-crt.pem'), 
}; 

var MySQLStore = require('connect-mysql')(session),
    options = {
      secret: 'secret squirrel',
    	config: {
    		user: 'jas-', 
    		password: '', 
    		database: 'c9'
    	}
    };

var index = require('./routes/index');
var users = require('./routes/users');

var app = express();

// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());

app.use(session({
  secret: 'supersecretkeygoeshere',
  store: new MySQLStore(options),
  resave: false,
  saveUninitialized: true
}));

app.use('/', function(req, res, next) {
  if (req.session.views) {
    req.session.views++
    res.setHeader('Content-Type', 'text/html')
    res.write('<p>views: ' + req.session.views + '</p>')
    res.write('<p>expires in: ' + (req.session.cookie.maxAge / 1000) + 's</p>')
    res.end()
  } else {
    req.session.views = 1
    res.end('welcome to the session demo. refresh!')
  }
});

var http = require('http');
console.log(process.env.PORT + ' => ' + process.env.IP)
// http.createServer(options, app).listen(process.env.PORT, process.env.IP);
http.createServer(app).listen(process.env.PORT, process.env.IP);
