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
    const files = glob.sync(`${artifact}/*.jar`, {});
    return files.map(v => {
      return {name: v, time: fs.statSync(v).mtime.getTime()};
    })
      .sort((a, b) => {
        return b.time - a.time;
      })
      .map((v) => v.name)[0];
  }

  // function to encode file data to base64 encoded string
  toBase64(file) {
    // read binary data
    const buffer = fs.readFileSync(file);
    // convert binary data to base64 encoded string
    return new Buffer(buffer).toString('base64');
  }

  generateActionPackage(functionObject) {
    let command = this.serverless.service.package.build || (process.platform === "win32" ? './gradlew.bat build' : './gradlew build');
    let cwd = this.serverless.service.package.cwd || ".";
    let artifact = this.serverless.service.package.artifact || `${cwd}/build/libs`;
    console.log(process.cwd());
    return this.build(command, cwd)
      .then((result) => {
        const stdout = result.stdout;
        const stderr = result.stderr;
        console.log(stdout);
        console.log(stderr);
        const resolved = this.resolveBuildArtifact(artifact);
        return this.toBase64(resolved);
        // 로드
      }).catch((e) => {
          console.log(e);
        }
      );
  }

  build(cmd, cwd) {
    return ChildProcessPromise.exec(cmd, {cwd});
  }
}

module.exports = GradleJava;
