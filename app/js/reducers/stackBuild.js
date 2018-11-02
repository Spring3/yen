const initialState = {
  destination: null,
  filePath: null,
  fileName: null,
  volumes: [],
  networks: [],
  services: []
};

module.exports = (state = initialState, action) => {
  switch (action.type) {
    case 'SET_STACK_DESTINATION': {
      return Object.assign({}, state, {
        fileName: action.fileName,
        filePath: action.filePath,
        destination: action.destination
      });
    }
    case 'SET_STACK_VOLUME': {
      if (!action.volume) {
        return state;
      }
      return Object.assign({}, state, {
        volumes: [...state.volumes, action.volume]
      });
    }
    case 'REMOVE_STACK_VOLUME': {
      if (typeof action.index !== 'number') {
        return state;
      }
      const newVolumes = [...state.volumes];
      newVolumes.splice(action.index, 1);
      return Object.assign({}, state, {
        volumes: newVolumes
      });
    }
    case 'SET_STACK_NETWORK': {
      if (!action.network) {
        return state;
      }
      return Object.assign({}, state, {
        networks: [...state.networks, action.network]
      });
    }
    case 'REMOVE_STACK_NETWORK': {
      if (typeof action.index !== 'number') {
        return state;
      }
      const newNetworks = [...state.networks];
      newNetworks.splice(action.index, 1);
      return Object.assign({}, state, {
        networks: newNetworks
      });
    }
    case 'SET_STACK_SERVICE': {
      if (!action.service) {
        return state;
      }
      return Object.assign({}, state, {
        services: [...state.services, action.service]
      });
    }
    case 'REMOVE_STACK_SERVICE': {
      if (typeof action.index !== 'number') {
        return state;
      }
      const newServices = [...state.services];
      newServices.splice(action.index, 1);
      return Object.assign({}, state, {
        services: newServices
      });
    }
    case 'REMOVE_STACKFILE': {
      return Object.assign({}, state, {
        filePath: undefined,
        fileName: undefined
      });
    }
    case 'STACKNAME_CHANGE': {
      return Object.assign({}, state, {
        fileName: action.fileName
      });
    }
    case 'PARSE_STACKFILE': {
      const { content } = action;
      let volumes = content.volumes || {};
      let networks = content.networks || {};
      let services = content.services || {};
      volumes = Object.keys(volumes).map(key => (Object.assign({ name: [key] }, volumes[key])));
      networks = Object.keys(networks).map(key => (Object.assign({ name: [key] }, networks[key])));
      services = Object.keys(services).map(key => (Object.assign({ name: [key] }, services[key])));
      return Object.assign({}, state, {
        volumes,
        networks,
        services
      });
    }
    default: {
      return state;
    }
  }
};
