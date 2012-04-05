var oneDay = 86400;

module.exports = function (connect) {
    var Store = connect.session.Store;

    function MySQLStore(options) {
        Store.call(this, options);
        this.mysql = options.client;
    }

    MySQLStore.prototype.__proto__ = Store.prototype;

    MySQLStore.prototype.get = function (sid, callback) {
        try {
            this.mysql.query('SELECT session, expires FROM sessions WHERE sid = ?', [sid], function (err, result) {
                if (result && result[0] && result[0].session) {
                    callback(null, JSON.parse(result[0].session));
                } else {
                    console.log('no data');
                    return callback();
                }
            });
        } catch (err) {
            console.log(err);
            callback(err);
        }
    };

    MySQLStore.prototype.set = function (sid, session, callback) {
        var ttl = typeof session.cookie.maxAge == 'number' ? session.cookie.maxAge / 1000 | 0 : oneDay;
        this.mysql.query('INSERT INTO sessions(sid, expires, session) VALUES(?, ?, ?) ON DUPLICATE KEY UPDATE expires=?, session=?', [sid, ttl, JSON.stringify(session), ttl, JSON.stringify(session)], function (err, result) {
            callback(err);
        });
    };

    MySQLStore.prototype.destroy = function (sid, callback) {
        this.mysql.query('DELETE FROM sessions WHERE sessions.sid = ?', [sid], function (err, result) {
            callback(err);
        });
    };

    return MySQLStore;
};
