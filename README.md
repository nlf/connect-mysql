[![build status](https://secure.travis-ci.org/nathan-lafreniere/connect-mysql.png)](http://travis-ci.org/nathan-lafreniere/connect-mysql)
#connect-mysql

This is a very, very simple MySQL backed session store for connect.

It uses an already established [node-mysql](https://github.com/felixge/node-mysql) client for the connection, and creates a 'sessions' table if it doesn't exist.


To use:

    var express = require('express'),
        mysql = require('mysql').createClient({ user: 'dbuser', password: 'dbpassword', database: 'db' }),
        MySQLStore = require('connect-mysql')(express);
    
    var app = express.createServer();
    app.use(express.cookieParser());
    app.use(express.session({ secret: 'supersecretkeygoeshere', store: new MySQLStore({ client: mysql })));

-----
License: MIT
