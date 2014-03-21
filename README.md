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

To use session encryption:

```javascript
...
	options = {
		secret: 'thesessionsecret',
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
* `retries`: how many times to retry connecting to the database before failing.  Defaults to `3`
* `keepalive`: keep pooled connections open by periodically pinging them.  Set to `true` to use the default interval of `30000` ms or provide a positive number to set your own.  Defaults to `true`.
* `cleanup`: a boolean specifying whether to enable the cleanup events. note that if this is disabled, cleanup will not take place at all and should be done externally.  Sessions with an expiration time of `0` will always be ignored and should also be cleaned up externally.
* `secret`: key that will be used to encrypt session data.  If this option is not provided then data will be stored in plain text
* `algorithm`: the algorithm that should be used to encrypt session data.  Defaults to `'aes-256-ctr'`

-----
License: MIT
