'use strict';

const BaseRuntime = require('./base');
const spawn = require('child_process').spawn;
const fs = require('fs');
const BbPromise = require('bluebird');
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
    // read binary dataq
    const buffer = fs.readFile(file);
    // convert binary data to base64 encoded string
    return new Buffer(buffer).toString('base64');
  }

  generateActionPackage(functionObject) {
    let command = this.serverless.service.package.build || (process.platform === "win32" ? 'gradlew.bat' : './gradlew');
    let cwd = this.serverless.service.package.cwd || ".";
    let artifact = this.serverless.service.package.artifact || `${cwd}/build/libs`;

    return this.build(command, ["build"], cwd)
      .then(() => {
        const readFile = BbPromise.promisify(fs.readFile);
        return readFile(this.resolveBuildArtifact(artifact));
      }).then(buffer => {
        return new Buffer(buffer).toString('base64');
      }).catch((err) => {
        this.serverless.cli.log(err);
      });
  }

  build(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
      this.serverless.cli.log(`running build cmd : ${cmd} ${args} in ${cwd}\n`);
      const buildJob = spawn(cmd, args, {cwd: cwd, stdio: ['inherit', 'inherit', 'inherit']});
      buildJob
        .on("error", reject)
        .on("close", (code) => {
          if (code === 0) {
            resolve();
          } else {
            reject(stderr);
          }
        });
    });
  }
}

module.exports = GradleJava;
