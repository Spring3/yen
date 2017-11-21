const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path').posix;
const fs = require('fs');
const url = require('url');
const { ReadableStream } = require('memory-streams');
const YML = require('yamljs');
const handlebars = require('handlebars');
const vagrant = require('vagrant');
const Action = require('./app/js/actions/action.js');

const correctCMD = /^\[("\S+",.)+"\S+"\]/;
const correctNoComma = /^\[("\S+".)+"\S+"\]/;
const CMDNoBrackets = /^("\S+",.)+"\S+"/;
const CMDNoBracketsAndComma = /^("\S+".)+"\S+"/;

class App {
  constructor(config) {
    this.mainScreen = null;
    this.windowConfig = config;
    this.action = new Action();
    this.init = this.init.bind(this);
    this.createDockerfile = this.createDockerfile.bind(this);
    this.reloadVagrant = this.reloadVagrant.bind(this);
    this.stopVagrant = this.stopVagrant.bind(this);
    this.updateNode = this.updateNode.bind(this);
    this.destroyNodes = this.destroyNodes.bind(this);
  }

  checkCMD(item) { // eslint-disable-line
    if (correctCMD.test(item)) {
      return item;
    } else if (correctNoComma.test(item)) {
      return item.split(' ').join(', ');
    } else if (CMDNoBrackets.test(item)) {
      return `[${item}]`;
    } else if (CMDNoBracketsAndComma.test(item)) {
      return `[${item.split(' ').join(', ')}]`;
    }
    const quoted = item.split(' ').map(i => `"${i}"`).join(', ');
    return `[${quoted}]`;
  }

  checkDestination(destination) {
    return new Promise((resolve, reject) => {
      fs.access(destination, fs.constants.F_OK | fs.constants.W_OK, (error) => {
        if (error) {
          console.error(error);
          return reject(error);
        }
        return resolve();
      });
    });
  }

  prepareVagrantFile(populatePayload) {
    return new Promise((resolve, reject) => {
      const vagrantFile = path.resolve(__dirname, './templates/Vagrantfile');
      this.action.checkFile(`${vagrantFile}.tpl`)
        .then(() => {
          const contents = fs.readFileSync(`${vagrantFile}.tpl`, { encoding: 'utf-8' });
          const template = handlebars.compile(contents);
          const settings = template(populatePayload);
          const stream = fs.createWriteStream(vagrantFile);
          stream.write(settings);
          stream.end();
          process.env.AUTO_START_SWARM = true;
          vagrant.start = path.resolve(__dirname, vagrantFile, '../');
          vagrant.up(resolve);
        })
        .catch(reject);
    });
  }

  reloadVagrant(nodes) {
    return new Promise((resolve, reject) => {
      if (!nodes || !Array.isArray(nodes)) return reject();
      const vagrantfile = path.resolve(__dirname, './templates/Vagrantfile');
      return this.action.checkFile(vagrantfile)
        .then(() => {
          vagrant.start = path.resolve(__dirname, vagrantfile, '../');
          const promises = [];
          for (const node of nodes) {
            const promise = new Promise((localResolve) => {
              vagrant.reload(node, localResolve);
            });
            promises.push(promise);
          }
          return Promise.all(promises).then(resolve);
        }).catch(reject);
    });
  }

  stopVagrant(nodes) {
    return new Promise((resolve, reject) => {
      if (!nodes || !Array.isArray(nodes)) return reject();
      const vagrantfile = path.resolve(__dirname, './templates/VagrantFile');
      return this.action.checkFile(vagrantfile)
        .then(() => {
          vagrant.start = path.resolve(__dirname, vagrantfile, '../');
          const promises = [];
          for (const node of nodes) {
            const promise = new Promise((localResolve) => {
              vagrant.suspend(node, localResolve);
            });
            promises.push(promise);
          }
          return Promise.all(promises).then(resolve);
        }).catch(reject);
    });
  }

  updateNode(node, config) {
    return new Promise((resolve, reject) => {
      if (!node || !config) return reject();
      const vagrantfile = path.resolve(__dirname, './templates/Vagrantfile');
      const customFile = path.resolve(__dirname, './templates/Customfile');
      return this.action.checkFile(vagrantfile)
        .then(() => {
          vagrant.start = path.resolve(__dirname, vagrantfile, '../');
          return this.action.readFile(`${customFile}.tpl`);
        })
        .then((contents) => {
          const template = handlebars.compile(contents);
          return this.action.writeFile(customFile, template(config));
        })
        .then(() => this.reloadVagrant(node))
        .then(() => this.action.deleteFile(customFile))
        .then(resolve)
        .catch(reject);
    });
  }

  destroyNodes(nodes) {
    return new Promise((resolve, reject) => {
      if (!nodes || !Array.isArray(nodes)) return reject();
      const vagrantfile = path.resolve(__dirname, './templates/VagrantFile');
      return this.action.checkFile(vagrantfile)
        .then(() => {
          vagrant.start = path.resolve(__dirname, vagrantfile, '../');
          const promises = [];
          for (const node of nodes) {
            const promise = new Promise((localResolve) => {
              vagrant.destroy(node, localResolve);
            });
            promises.push(promise);
          }
          promises.push(this.action.deleteFile(vagrantfile));
          return Promise.all(promises).then(resolve);
        }).catch(reject);
    });
  }

  createDockerfile(destination, payload) {
    return new Promise(resolve =>
      this.checkDestination(destination).then(() => {
        const fileName = 'Dockerfile';
        const order = ['ARG', 'FROM', 'LABEL', 'USER', 'SHELL', 'WORKDIR', 'ADD', 'COPY', 'RUN', 'EXPOSE', 'ENV', 'VOLUME', 'ENTRY POINT', 'ONBUILD', 'STOP SIGNAL', 'HEALTHCHECK', 'CMD'];
        const multiline = ['ARG', 'EXPOSE', 'LABEL', 'ADD', 'COPY', 'RUN', 'ENV', 'ONBUILD'];
        const dockerfile = fs.createWriteStream(path.join(destination, fileName));
        const source = new ReadableStream();
        source.append('# Generated by Riptide https://github.com/Spring3/riptide \n');
        for (const item of order) {
          if (payload[item]) {
            if (item.toUpperCase() === 'CMD') {
              payload[item] = this.checkCMD(payload[item]); // eslint-disable-line
            }
            // EXPOSE 8000
            let content = `${item} ${payload[item].trim()}`;
            if (payload[item].toUpperCase().includes(`${item} `)) {
              // if already has EXPOSE in value
              content = `${payload[item].trim()}`;
            }
            if (multiline.includes(item)) {
              content = payload[item].split('\n')
                .filter(i => i && i.trim())
                .map((i) => {
                  const command = i.trim();
                  if (command.toUpperCase().includes(`${item} `)) {
                    // ENV NODE_ENV=production
                    return `${command}`;
                  }
                  // if does not have ENV
                  return `${item} ${command.trim()}`;
                }).join('\n');
            }
            source.append(`${content}\n\n`);
          }
        }
        source.pipe(dockerfile);
        return resolve({
          fileName,
          filePath: destination
        });
      }).catch(() => resolve({}))
    );
  }

  flattenByName(arrayOfItems) {
    if (!Array.isArray(arrayOfItems) || arrayOfItems.length === 0) return '';
    const items = [...arrayOfItems];
    const result = items.filter(item => !!item).map((item) => {
      const { name } = item;
      delete item.name; // eslint-disable-line
      console.log(item);
      return {
        [name]: Object.keys(item).length > 0 ? item : ''
      };
    }).reduce((sum, current) => Object.assign({}, sum, current));
    console.log(result);
    return result;
  }

  createStackfile(destination, filename, contents) {
    return new Promise(resolve =>
      this.checkDestination(destination).then(() => {
        const stackfile = fs.createWriteStream(path.join(destination, filename));
        const source = new ReadableStream();
        source.append('# Generated by Riptide https://github.com/Spring3/riptide \n\n');
        source.append('version: "3"\n\n');
        const emptyStringRegex = /:\s['"]{2}/gm;
        const flatNetworks = this.flattenByName(contents.networks);
        const flatNetworksYML = YML.stringify({ networks: flatNetworks }, 5, 2).replace(emptyStringRegex, ':');
        const flatVolumes = this.flattenByName(contents.volumes);
        const flatVolumesYML = YML.stringify({ volumes: flatVolumes }, 5, 2).replace(emptyStringRegex, ':');
        const flatServices = this.flattenByName(contents.services);
        const flatServicesYML = YML.stringify({ services: flatServices }, 5, 2).replace(emptyStringRegex, ':');
        source.append(flatNetworks ? `${flatNetworksYML}\n\n` : 'networks:\n\n');
        source.append(flatVolumes ? `${flatVolumesYML}\n\n` : 'volumes:\n\n');
        source.append(flatServices ? `${flatServicesYML}\n\n` : 'services:\n\n');
        source.pipe(stackfile);
        return resolve({
          fileName: filename,
          filePath: destination
        });
      }).catch(() => resolve({}))
    );
  }

  init() {
    this.mainScreen = new BrowserWindow(this.windowConfig);
    this.mainScreen.loadURL(url.format({
      pathname: path.join(__dirname, './app/index.html'),
      protocol: 'file:',
      slashes: true
    }));

    if (process.env.NODE_ENV !== 'produciton') {
      this.mainScreen.webContents.openDevTools();
    }

    this.mainScreen.on('closed', () => {
      delete this.mainScreen;
    });

    ipcMain.on('build', (event, data) => {
      switch (data.type.toUpperCase()) {
        case 'DOCKERFILE': {
          this.createDockerfile(data.destination, data.payload).then(result => event.sender.send('build:rs', result)).catch(console.error);
          break;
        }
        case 'STACKFILE': {
          this.createStackfile(data.destination, data.filename, data.stackfile).then(result => event.sender.send('build:rs', result)).catch(console.error);
          break;
        }
        case 'VAGRANTFILE': {
          this.prepareVagrantFile(data.payload);
          break;
        }
        default: {
          console.error('Unsupported file format');
        }
      }
    });

    ipcMain.on('stop', (event, data) => {
      switch (data.type.toUpperCase()) {
        case 'VAGRANT': {
          this.stopVagrant(data.nodes).then(() => event.sender.send('stop:rs', true)).catch(console.error);
          break;
        }
        default: {
          console.error('Unsupported infrastructure type');
        }
      }
    });

    ipcMain.on('update', (event, data) => {
      switch (data.type.toUpperCase()) {
        case 'VAGRANT': {
          this.updateNodes(data.node, data.config).then(() => event.sender.send('update:rs', true)).catch(console.error);
          break;
        }
        default: {
          console.error('Unsupported infrastructure type');
        }
      }
    });

    ipcMain.on('destroy', (event, data) => {
      switch (data.type.toUpperCase()) {
        case 'VAGRANT': {
          this.destroyNodes(data.nodes).then(() => event.sender.send('destroy:rs', true)).catch(console.error);
          break;
        }
        default: {
          console.error('Unsupported infrastructure type');
        }
      }
    });

    ipcMain.on('reload', (event, data) => {
      switch (data.type.toUpperCase()) {
        case 'VAGRANT': {
          this.reloadVagrant(data.nodes).then(() => event.sender.send('reload:rs', true)).catch(console.error);
          break;
        }
        default: {
          console.error('Unsupported infrastructure type');
        }
      }
    });

    ipcMain.on('vagrantStatus', (event) => {
      this.action.checkFile(path.resolve(__dirname, './templates/Vagrantfile'))
        .then(() => event.sender.send('vagrantStatus:rs', 'paused'))
        .catch(() => event.sender.send('vagrantStatus:rs', 'stopped'));
    });
  }
}

const Riptide = new App({ width: 800, height: 600 });

console.log(app.getPath('userData'));
app.on('ready', Riptide.init);
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
app.on('activate', () => {
  if (Riptide.mainScreen === null) {
    Riptide.init();
  }
});
