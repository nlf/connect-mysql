#connect-mysql

This is a simple MySQL backed session store for connect.

It uses the [node-mysql](https://github.com/felixge/node-mysql) module already installed in your project to establish and pool connections.


## Usage

```javascript
var express = require('express'),
    MySQLStore = require('connect-mysql')(express),
    options = { 
    	config: {
    		user: 'dbuser', 
    		password: 'dbpassword', 
    		database: 'db' 
    	}
    };

var app = express.createServer();
app.use(express.cookieParser());
app.use(express.session({ secret: 'supersecretkeygoeshere', store: new MySQLStore(options)));
```

For connection pooling use

```javascript
...
    mysql = reqire('mysql'),
    options = {
    	pool: mysql.createPool({ user: 'dbuser', password: 'dbpassword', database: 'db' })
    };
...
```

Or

```javascript
...
	options = {
		pool: true,
		config: {
    		user: 'dbuser', 
    		password: 'dbpassword', 
    		database: 'db' 
    	}
	};
...
```

## Options

* `table`: the name of the database table that should be used for storing sessions. Defaults to `'sessions'`
* `pool`: a node-mysql connection pool or `true` if the store should instantiate its own pool
* `config`: the configuration that will be passed to `createConnection()` or `createPool()` if pool is `true`
* `cleanup`: a boolean specifying whether to enable the cleanup events. note that if this is disabled, cleanup will not take place at all and should be done externally. 

-----
License: MIT
