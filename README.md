# connect-mysql

This is a simple MySQL backed session store for connect.

It uses the [node-mysql](https://github.com/felixge/node-mysql) module already installed in your project to establish and pool connections.

## Upgrading

Changes introduced in v2.2 mean sessions stored in earlier versions are not backwards compatible with v2.2.
It it recommended that you clear the session table; alternately sessions will be discarded with a warning message.

## Options

* `table`: the name of the database table that should be used for storing sessions. Defaults to `'sessions'`
* `pool`: a node-mysql connection pool or `true` if the store should instantiate its own pool
* `config`: the configuration that will be passed to `createConnection()` or `createPool()` if pool is `true`
* `retries`: how many times to retry connecting to the database before failing.  Defaults to `3`
* `keepalive`: keep pooled connections open by periodically pinging them.  Set to `true` to use the default interval of `30000` ms or provide a positive number to set your own.  Defaults to `true`.
* `cleanup`: a boolean specifying whether to enable the cleanup events. note that if this is disabled, cleanup will not take place at all and should be done externally.  Sessions with an expiration time of `0` will always be ignored and should also be cleaned up externally.
* `secret`: key that will be used to encrypt session data.  If this option is not provided then data will be stored in plain text
* `algorithm`: the algorithm that should be used to encrypt session data.  Defaults to `'aes-256-ctr'`


## Examples
Here are some example use cases to get your application up and running.

### Default use case
Simple use case using the `express` framework & `connect-session` middleware with `connect-mysql` as the data store.

```javascript
var express = require('express'), // express framework
    session = require('express-session'), // session middleware
    cookieParser = require('cookie-parser'), // cookie middleware
    MySQLStore = require('connect-mysql')(session), // mysql session store
    options = {
      config: {
        user: 'username', 
        password: 'password',
        database: 'databasename' 
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
  store: new MySQLStore(options) // Change the express session store
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
```

### Connection pooling example
For those MySQL installations that make use of pools the following examples are available.

```javascript
  var mysql = require('mysql'),
      options = {
        pool: mysql.createPool({
          user: 'dbuser',
          password: 'dbpassword',
          database: 'db'
        })
      };
```

Or

```javascript
var options = {
      pool: true,
      config: {
        user: 'dbuser', 
        password: 'dbpassword', 
        database: 'db' 
      }
    };
```

### Ssession encryption example
This option enables transparent session encryption assisting

```javascript
var options = {
      secret: 'thesessionsecret',
      config: {
        user: 'dbuser', 
        password: 'dbpassword', 
        database: 'db' 
      }
   };
```

## contributing ##

Contributions are welcome & appreciated. Refer to the [contributing document](https://github.com/nlf/connect-mysql/blob/master/CONTRIBUTING.md)
to help facilitate pull requests.

## license ##

This software is licensed under the [MIT License](https://github.com/nlf/connect-mysql/blob/master/LICENSE).

Nathan LaFreniere, Copyright (c) 2012 &Yet