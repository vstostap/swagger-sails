var SwaggerRunner = require('swagger-node-runner');
var path = require('path');

module.exports = function swaggerHook(sails) {

  return {

    //defaults: {
    //  __configKey__: {}
    //},

    //configure: function() {},

    initialize: function initialize(cb) {

      var config = {
        appRoot: sails.config.appPath,
        configDir: sails.config.paths.config,
        controllersDirs: [sails.config.paths.controllers],
        mockControllersDirs: [path.resolve(sails.config.paths.controllers, '..', 'mocks')],
        swaggerFile: path.resolve(sails.config.paths.controllers, '..', 'swagger', "swagger.yaml")
      };

      SwaggerRunner.create(config, function(err, runner) {
        if (err) { return cb(err); }

        sails.hooks['swagger-sails-hook'].runner = runner;

        return cb();
      });
    },

    routes: {
      after: {
        '/*': function(req, res, next) {
            var runner = sails.hooks['swagger-sails-hook'].runner;
            if(!runner) return next();

            var operation = runner.getOperation(req);

            if (!operation) {
                var path = req.path;
                req.swagger = req.swagger || {};
                operation = {pathObject: { 'x-swagger-pipe': path }};
            }

            runner.applyMetadata(req, operation, function(err) {
              if (err) return next(err);

              var pipe = runner.getPipe(req);
              if (!pipe) return next();

              var context = {
                // system values
                _errorHandler: runner.defaultErrorHandler(),
                request: req,
                response: res,

                // user-modifiable values
                input: undefined,
                statusCode: undefined,
                headers: {},
                output: undefined
              };

              context._finish = function finishConnect(ignore1, ignore2) { // must have arity of 2

                if (context.error) return next(context.error);

                try {
                  var response = context.response;

                  if (context.statusCode) {

                    response.statusCode = context.statusCode;
                  }

                  if (context.headers) {

                    _.each(context.headers, function(value, name) {
                      response.setHeader(name, value);
                    });
                  }

                  if (context.output) {
                    var body = context.output;


                    response.end(body);
                  }
                }
                catch (err) {
                  next(err);
                }
              };

              runner.bagpipes.play(pipe, context);
            });
        }
      }
    }
  };

};

/*
TODO:
  add ability through config to move the routing to before instead of after?
  configure swagger paths (config, controllers, etc.) separately from Sails paths?
  integrate swagger-node configuration into Sails' configuration system?
*/
