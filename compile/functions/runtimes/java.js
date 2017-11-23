'use strict';

const BaseRuntime = require('./base');
const ChildProcessPromise = require('child-process-promise');
const BbPromise = require('bluebird');
const fs = require('fs');
const glob = require("glob");

class GradleJava extends BaseRuntime {
  constructor(serverless) {
    super(serverless);
    this.kind = 'java'
  }

  calculateFunctionMain(functionObject) {
    return functionObject.handler;
  }

  resolveBuildArtifact(artifact) {
    // if artifact is end with jar... just return it..
    const files = glob.readdirSync(artifact + '/*.jar', {});
    return files.map((v) => {
      return {
        name: v,
        time: fs.statSync(dir + v).mtime.getTime()
      };
    })
      .sort(function (a, b) {
        return b.time - a.time;
      })
      .map(function (v) {
        return v.name;
      })[0];
  }

  generateActionPackage(functionObject) {
    let command = this.serverless.service.package.build || (process.platform === "win32" ? './gradlew.bat build' : './gradlew build');
    let artifact = this.serverless.service.package.artifact || "build/libs";

    console.log(process.cwd());

    return this.build(command)
      .then((result) => {
        const stdout = result.stdout;
        const stderr = result.stderr;
        console.log('stdout: ', stdout);
        console.log('stderr: ', stderr);
      
        return "wwewewe";
        // .log("wow");
        // return this.resolveBuildArtifact(artifact);
        // 로드
      }).catch(() => {
          console.log("ewe");
        }
      );
  }

  build(cmd) {
    return ChildProcessPromise.exec(cmd);
  }
}

module.exports = GradleJava;
