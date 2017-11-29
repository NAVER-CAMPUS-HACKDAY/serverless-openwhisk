'use strict';

const BbPromise = require('bluebird');
const _ = require('lodash');
const path = require('path');
const chalk = require('chalk');
const stdin = require('get-stdin');
const spawn = require('child_process').spawn;

class OpenWhiskInvokeLocal {
  constructor(serverless, options) {
    this.serverless = serverless;
    this.options = options || {};
    this.provider = this.serverless.getProvider('openwhisk');

    this.hooks = {
      'invoke:local:invoke': () => BbPromise.bind(this)
        .then(this.validate)
        .then(this.loadEnvVars)
        .then(this.invokeLocal),
    };
  }

  validate() {
    if (!this.serverless.config.servicePath) {
      throw new this.serverless.classes.Error('This command can only be run inside a service.');
    }

    this.options.functionObj = this.serverless.service.getFunction(this.options.function);

    return new BbPromise(resolve => {
      if (this.options.data) {
        resolve();
      } else if (this.options.path) {
        const absolutePath = path.isAbsolute(this.options.path) ?
          this.options.path :
          path.join(this.serverless.config.servicePath, this.options.path);
        if (!this.serverless.utils.fileExistsSync(absolutePath)) {
          throw new this.serverless.classes.Error('The file you provided does not exist.');
        }
        this.options.data = this.serverless.utils.readFileSync(absolutePath);
        resolve();
      } else {
        stdin().then(input => {
          this.options.data = input;
          resolve();
        });
      }
    }).then(() => {
      const params = this.options.functionObj.parameters || {};
      let data = {};
      try {
        if(typeof this.options.data === 'object') {
          data = this.options.data;
        } else {
          data = JSON.parse(this.options.data);
        }
      } catch (exception) {
        // do nothing if it's a simple string or object already
      }

      this.options.data = Object.assign(params, data);
    });
  }

  loadEnvVars() {
    return this.provider.props().then(props => {
      const envVars = {
        __OW_API_KEY: props.auth,
        __OW_API_HOST: props.apihost,
        __OW_ACTION_NAME: this.calculateFunctionName(this.options.function, this.options.functionObj),
        __OW_NAMESPACE: this.calculateFunctionNameSpace(this.options.functionObj)
      };

      _.merge(process.env, envVars);

      return BbPromise.resolve();
    })
  }

  calculateFunctionName(functionName, functionObject) {
    const namespace = this.calculateFunctionNameSpace(functionObject);
    const name = functionObject.name || `${this.serverless.service.service}_${functionName}`;
    return `/${namespace}/${name}`
  }

  calculateFunctionNameSpace(functionObject) {
    return functionObject.namespace
      || this.serverless.service.provider.namespace
      || '_';
  }

  invokeLocal() {
    const runtime = this.options.functionObj.runtime
      || this.serverless.service.provider.runtime
      || 'nodejs:default';
    const handler = this.options.functionObj.handler;
    const handlerPath = handler.split('.')[0];
    const handlerName = handler.split('.')[1];

    if (runtime.startsWith('nodejs')) {
      return this.invokeLocalNodeJs(
        handlerPath,
        handlerName,
        this.options.data);
    } else if (runtime.startsWith('python')) {
      return this.invokeLocalPython(
        handlerPath,
        handlerName,
        this.options.data);
    } else if (runtime.startsWith('java')) {
      return this.invokeLocalJava(
        handler,
        this.options.data);
    }

    throw new this.serverless.classes
      .Error('You can only invoke Node.js or Python functions locally.');
  }

  invokeLocalNodeJs(handlerPath, handlerName, params) {
    let action, result;

    try {
      /*
       * we need require() here to load the handler from the file system
       * which the user has to supply by passing the function name
       */
      action = require(path // eslint-disable-line global-require
        .join(this.serverless.config.servicePath, handlerPath))[handlerName];
    } catch (error) {
      this.serverless.cli.consoleLog(error);
      process.exit(0);
    }

    try {
      let result = action(params)
      return Promise.resolve(result).then(result => {
        this.serverless.cli.consoleLog(JSON.stringify(result, null, 4));
      }).catch(err => {
        const errorResult = {
          errorMessage: err.message || err,
          errorType: err.constructor.name,
        };
        this.serverless.cli.consoleLog(chalk.red(JSON.stringify(errorResult, null, 4)));
        process.exitCode = 1;
      })
    } catch (err) {
      const errorResult = {
        errorMessage: err.message,
        errorType: err.constructor.name,
      };
      this.serverless.cli.consoleLog(chalk.red(JSON.stringify(errorResult, null, 4)));
      process.exitCode = 1;
    }
  }

  invokeLocalPython(handlerPath, handlerName, params) {
    if (process.env.VIRTUAL_ENV) {
      process.env.PATH = `${process.env.VIRTUAL_ENV}/bin:${process.env.PATH}`;
    }
    return new BbPromise(resolve => {
      const python = spawn(
        path.join(__dirname, 'invoke.py'), [handlerPath, handlerName], { env: process.env });
      python.stdout.on('data', (buf) => this.serverless.cli.consoleLog(buf.toString()));
      python.stderr.on('data', (buf) => this.serverless.cli.consoleLog(buf.toString()));
      python.stdin.write(JSON.stringify(params || {}));
      python.stdin.end();
      python.on('close', () => resolve());
    });
  }

  invokeLocalJava(handler, params) {
    const command = this.serverless.service.package.build ||
      (process.platform === 'win32' ? './gradlew.bat' : './gradlew');
    const cwd = this.serverless.service.package.cwd || '.';
    const jarDir = this.serverless.service.package.jar_dir || `${cwd}/build/libs`;
    return new BbPromise((resolve, reject) => {
      const buildInvoker = spawn(command, ['build', '-P', 'includeInvoker'], { cwd, stdio: 'inherit' });
      buildInvoker
        .on('error', reject)
        .on('close', (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(stderr);
          }
        });
    })
      .then(() => {
      const run = spawn('java', ['-jar', `${jarDir}/FunctionLoader.jar`, handler, JSON.stringify(params)], {
        cwd, stdio: 'inherit' });
      run
        .on('error', (err) => {
          this.serverless.cli.consoleLog(err);
          process.exit(1);
        });
    });
  }
}

module.exports = OpenWhiskInvokeLocal;
