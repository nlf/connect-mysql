var express = require('express'), // express framework
    session = require('express-session'), // session middleware
    cookieParser = require('cookie-parser'), // cookie middleware
    MySQLStore = require('connect-mysql')(session), // mysql session store
    options = {
      secret: 'squirrel',
      config: {
        user: 'jas', 
        password: 'password',
        database: 'test'
      }
    },
    app = express();

app.use(cookieParser());

app.use(session({
  secret: 'keyboard cat',
  resave: false,
  saveUninitialized: true,
  cookie: {
    httpOnly: false,
    secure: false,
    maxAge: 1000 * 60 * 60 * 24 * 3,
    expires: 1000 * 60 * 60 * 24 * 3
  },
  store: new MySQLStore(options)
}));

app.get('/', function (req, res) {
  if (req.session.views) {
    req.session.views++
  } else {
    req.session.views = 1;
  }

  res.send('Hello world! '+req.session.views);
});
 
app.listen(3000, 'localhost');
