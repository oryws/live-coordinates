const r = require('rethinkdb');

const dbHandler = {
  /*
   * Ensures we have a database
   */
  createDatabase: (conn, dbName) => {
    return new Promise((resolve, reject) => {
      console.log(`Looking for database ${dbName}`);
      r.dbList().contains(dbName).run(conn).then(dbExists => {
        if(dbExists) {
          console.log(`Database ${dbName} already there, so don't worry mate`);
          resolve(conn);
        } else {
          console.log(`No database, creating...`);
          r.dbCreate(dbName).run(conn).then(() => {
            console.log(`Database created mate, have a nice day`);
            resolve(conn);
          }).catch(ex => reject(ex));
        }
      }).catch(ex => reject(ex));
    });
  },

  createTable: (conn, dbName, tableName) => {
    return new Promise((resolve, reject) => {
      console.log(`Looking for table ${tableName}`);
      r.db(dbName).tableList().contains(tableName).run(conn).then(tableExists => {
        if(tableExists) {
          console.log(`Table exists, no work for me`);
          resolve(conn);
        } else {
          console.log(`Creating table ${tableName}`);
          r.db(dbName).tableCreate(tableName).run(conn).then(() => {
            console.log(`Table ${tableName} created`);
            resolve(conn);
          }).catch(ex => reject(ex));
        }
      }).catch(ex => reject(ex));
    })
  }
}

module.exports = dbHandler;