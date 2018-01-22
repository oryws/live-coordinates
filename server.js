require('dotenv').load();

const express = require('express');
const app = express();
const r = require('rethinkdb');
const faye = require('faye');
const bodyParser = require('body-parser');
const server = require('http').Server(app);

const dbHelper = require('./helpers/db_helper');

const dbName = process.env.DBNAME || 'Skycatch';
const tableName = process.env.TBNAME || 'Places'
const port = process.env.PORT || 3000

// Set bayeux (server?)
let bayeux = new faye.NodeAdapter({mount: '/faye', timeout: 60});
bayeux.attach(server);

// Throw that frontend to the front
app.use(express.static('public'));

// Parse because why not
app.use(bodyParser.urlencoded({ extended: false }))
app.use(bodyParser.json());

// Connecting to rethink
r.connect({}).then(conn => {
  console.log('Connected to rethink');
  return dbHelper.createDatabase(conn, dbName);
}).then(conn => {
  return dbHelper.createTable(conn, dbName, tableName);
}).then(conn => {
  console.log('Adding routes');

  app.post('/places', (req, res) => {
    const req_fields = ['lat', 'long', 'name', 'status'];
    let errors = [];

    // Catch incomplete places
    req_fields.forEach(req_field => {
      if(typeof req.body[req_field] === 'undefined') {
        errors.push(`You have to provide a ${req_field}`);
      }
    });
    if(errors.length > 0) {
      return res.status(400).send(errors);
    }

    // Create the place
    r.db(dbName).table(tableName).insert(req.body).run(conn).then(status => {
      return r.db(dbName).table(tableName).get(status.generated_keys[0]).run(conn);
    }).then(place => {
      // Return the created place
      delete place.udid;
      res.json(place);
    }).catch(err => {
      return res.status(500).send(err);
    });
  });

  app.get('/places', (req, res) => {
    r.db(dbName).table(tableName).filter({}).run(conn).then(cursor => {
      return cursor.toArray();
    }).then(places => {
      res.json(places);
    });
  });

  app.get('places/:id', (req, res) => {
    r.db(dbName).table(tableName).filter({id: req.params.id}).run(conn).then(cursor => {
      return cursor.toArray();
    }).then(places => {
      if(places.length > 0) {
        const place = places[0];
        res.json(place);
      } else {
        res.sendStatus(404);
      }
    });
  });

  app.put('places/:id', (req, res) => {
    r.db(dbName).table(tableName).filter({id: req.params.id}).run(conn).then(cursor => {
      return cursor.toArray();
    }).then(places => {
      if(places.length > 0) {
        let place = places[0];
        delete req.body.id;

        r.db(dbName).table(tableName).get(place.id).update(req.body).run(conn).then(status => {
          return r.db(dbName).table(tableName).get(place.id).run(conn);
        }).then(place => {
          res.json(place);
        }).catch(err => {
          return res.status(500).send(err);
        });
      } else {
        res.sendStatus(404);
      }
    }).catch(err => {
      return res.status(500).send(err);
    });
  });

  app.delete('/places/:id', (req, res) => {
    r.db(dbName).table(tableName).filter({id: req.params.id}).delete().run(conn).then(status => {
      return res.json(status);
    }).catch(err => {
      return res.status(500).send(err);
    });
  });

  // Now subscribe to all place events
  r.db(dbName).table(tableName).changes().run(conn).then(cursor => {
    cursor.each((err, change) => {
      if((change.new_val) && (!change.old_val)) {
        bayeux.getClient().publish(`/places/${change.new_val.state}`, {
          type: 'created',
          place: change.new_val
        });
      } else if((change.new_val) && (change.old_val)) {
        bayeux.getClient().publish(`/places/${change.new_val.state}`, {
          type: 'updated',
          place: change.new_val
        });
      } else {
        bayeux.getClient().publish(`/places/${change.old_val.state}`, {
          type: 'removed',
          place: change.old_val
        });
      }
    });
  });

  return conn;

}).catch(ex => console.log(ex));

server.listen(port, () => {
  console.log(`Server running on port ${port}`);
});