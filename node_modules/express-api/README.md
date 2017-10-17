# express-api

Express-api is an API framework based on Swagger.

Express-api uses CSON, JSON or YAML files to expose your apis using the
eapiger specs. Express-eapi reloads schemas in development facilitating schema
creation.

DO NOT USE, WIP! Documentation is inaccurate.

## Using

Install the library

    npm install express-api

Create resource listings schema and resource schema files in a common
directory, eg `public/api/docs`. Here are the official examples

- [petstore resource listing](http://petstore.eapiger.wordnik.com/api/api-docs)
- [petstore resource](http://petstore.eapiger.wordnik.com/api/api-docs/pet)

Implement your resource API. NOTE, the name of your resoure methods must match
the `nickname` property in the schema operations

```
//// pet.json
apis: [{
  path: "/pet/{petId}",
  operations: [{
    summary: "Find pet by ID",
    nickname: "getPetById",
   }]
}]
```

```
//// resource/pet.js
exports.getPetById = function(req, res) {
}
```

Wire it all up

```
var express = require('express');
var app = express();
var Swag = require('express-eapi');

// create routers for API and docs
var apiRouter = express.Router();
var docsRouter = epxress.Router();
app.use('/api', apiRouter);
app.use('/api/api-docs', docsRouter);

var eapi = new Swag({
  apiRouter: apiRouter,
  docsRouter: docsRouter,
  docsDir: 'public/api/docs',
  extname: '.json'
});

eapi
  .addApi('pet.json', require('./resources/pet.js'))
  .addApi('user.json', require('./resources/user.js'))
  .configureDocs('index.json', 'http://localhost:8000/api');

app.listen(3000);
```

Browser your json schemas at `http://localhost:3000/api/api-docs` or
through the eapiger UI.

## Middleware

The primary reason for creating express-api is the lack of support for
plain middleware in other frameworks.

The implementation method can either be a function or array of functions.

    exports.getPetById = function(req, res, next) { ... };

    exports.getPetById = [
      validationMiddleware({ body: {id: joi.integer()}}),
      function(req, res, next) { ... };
    ];

That can be a bit tedious. Express-api can use middleware as plugins. Let's
create one.

    function validate(req, res, next) {
      // get the spec for the current operation
      var spec = req.__eapiger.operation;
      var params = spec.parameters;
      params.forEach(function(param) {
        if (param.required && param.paramType === 'path')  {
          if (!req.params[param.name]) res.send(400, 'Require argument missing' + param.name);
        }
      });

      next();
    }

To use it

    eapi
      .use(validate)
      .addApi('pet.json', require('./resources/pet.js'))

The position matters. All middleware used before `addApi` are applied before
a operation method in the pipeline. Post filters look like this.

    eapi
      .addApi('pet.json', require('./resources/pet.js'))
      .use(normalizeResult);
