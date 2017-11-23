'use strict';

const BaseRuntime = require('./base');
const execmodule = require('child_process');
const fs = require('fs');
const glob = require("glob");

class GradleJava extends BaseRuntime {
  constructor (serverless) {
    super(serverless);
    this.kind = 'java'
  }

  calculateFunctionMain(functionObject) {
    return functionObject.handler;
  }

  resolveBuildArtifact(artifact) {
    // if artifact is end with jar... just return it..
    const files = glob.readdirSync(artifact + '/*.jar', {});
    return files.map((v)=> {
      return { 
        name:v,
        time:fs.statSync(dir + v).mtime.getTime()
      };
    })
      .sort(function(a, b) { return b.time - a.time; })
      .map(function(v) { return v.name; })[0];
  }
  
  generateActionPackage(functionObject) {

      let command = (process.platform === "win32" ? './gradlew.bat build' : './gradlew build');
      let artifact = this.serverless.service.package.artifact || "build/libs";

      this.serverless.cli.consoleLog(process.cwd());

      return this.build(command,(jar) => this.serverless.cli.consoleLog("call back"))
          .then(() => {
            artifact = this.resolveBuildArtifact(artifact);
            // 로드
      });
  }

    build(cmd) {
        this.serverless.cli.consoleLog(cmd);
        const execs = BbPromise.promisify(execmodule.execFile(cmd));
        return execs(cmd, (err, out, code)  => {
            if (err instanceof Error)
                throw err;
            process.stderr.write(err);
            process.stdout.write(out);
            if (code !== 0) {
                process.exit(-1);
            }
        });
    }
}

module.exports = GradleJava;
