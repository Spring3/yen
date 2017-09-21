import React from 'react';
import { ipcRenderer } from 'electron';
import PropTypes from 'prop-types';
import { connect } from 'react-redux';
import Box from 'grommet/components/Box';
import FormField from 'grommet/components/FormField';
import FormFields from 'grommet/components/FormFields';
import TextInput from 'grommet/components/TextInput';
import Button from 'grommet/components/Button';
import Select from 'grommet/components/Select';
import Toast from 'grommet/components/Toast';
import Section from 'grommet/components/Section';
import Heading from 'grommet/components/Heading';
import Paragraph from 'grommet/components/Paragraph';
import Preview from '../components/Modal.jsx';

import Download from 'grommet/components/icons/base/DocumentDownload';
import Search from 'grommet/components/icons/base/Search';
import Trash from 'grommet/components/icons/base/Trash';

import actions from '../actions/actions.js';

const fs = require('fs');
const path = require('path');

class ImageBuildPage extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      selected: this.props.selected || ['FROM', 'CMD', 'EXPOSE', 'ENV', 'COPY', 'WORKDIR'],
      data: this.props.data || {},
      toast: false,
      toastMessage: ''
    };
    this.selectionChanged = this.selectionChanged.bind(this);
    this.valueChanged = this.valueChanged.bind(this);
    this.buildDockerFile = this.buildDockerFile.bind(this);
    this.togglePreview = this.togglePreview.bind(this);
    this.deleteFile = this.deleteFile.bind(this);
  }

  componentWillMount() {
    this.listener = (e, data) => {
      const self = this;
      this.setState({
        toast: true,
        toastMessage: `${data.fileName} was created in ${data.filePath}`,
        fileName: data.fileName,
        filePath: data.filePath
      }, () => {
        setTimeout(() => {
          self.setState({
            toast: false,
            toastMessage: ''
          });
        }, 5000);
      });
    };
    ipcRenderer.on('build:rs', this.listener);
  }

  componentWillUnmount() {
    ipcRenderer.removeListener('build:rs', this.listener);
  }

  selectionChanged(e) {
    const { store } = this.context;
    const action = {
      type: 'PICK_IMAGE_FIELD',
      used: e.value.includes(e.option),
      field: e.option
    };
    store.dispatch(action);
  }

  componentWillReceiveProps(nextProps) {
    console.log(nextProps);
    if (nextProps.selected.length !== this.state.selected.length) {
      this.setState({
        selected: nextProps.selected
      });
    }
    if (JSON.stringify(this.state.data) !== JSON.stringify(nextProps.data)) {
      console.log('here');
      this.setState({
        data: nextProps.data
      });
    }
  }

  valueChanged(e) {
    const { store } = this.context;
    store.dispatch({
      type: 'IMAGE_VALUE_CHANGE',
      field: e.target.name.toUpperCase(),
      value: e.target.value
    });
  }

  buildDockerFile() {
    if (Object.keys(this.state.data) > 0) {
      const payload = this.state.selected
        .map(item => ({ [item]: this.state.data[item]}))
        .reduce((sum, next) => Object.assign(sum, next));
      const data = {
        type: 'DOCKERFILE',
        payload
      };
      ipcRenderer.send('build', data);
    }
  }

  togglePreview() {
    if (!this.state.preview) {
      actions.readFile(`${this.state.filePath}${path.sep}${this.state.fileName}`)
      .then((content) => {
        this.setState({
          preview: !this.state.preview,
          content
        });
      })
      .catch(() => {
        this.setState({
          fileName: null,
          filePath: null,
          content: null
        });
      });
    } else {
      this.setState({
        preview: !this.state.preview
      });
    }
  }

  deleteFile() {
    const file = `${this.state.filePath}${path.sep}${this.state.fileName}`;
    actions.deleteFile(file)
    .then(() => {
      this.setState({
        fileName: null,
        filePath: null
      });
    });
  }

  render() {
    return (
      <Box>
        {
          this.state.preview ?
          <Preview closeBtn={true} toggleModal={this.togglePreview}>
            <Section style={{ whiteSpace: 'pre' }}>
              <Heading tag='h3' strong={true} margin='none'>{this.state.fileName}</Heading>
              <hr className='invisible'/>
              <Paragraph>
                {this.state.content}
              </Paragraph>
            </Section>
          </Preview>
          : ''
        }
        {
          this.state.toast ? 
          <Toast status='ok'>{this.state.toastMessage}</Toast> : ''
        }
        <Box direction='row' pad={{ horizontal: 'medium' }} className='left-padded'>
          <Box className='wrapper-borderless' full='horizontal' alignContent="stretch">
            {
              this.state.selected.includes('ARG') ? 
              <FormFields>
                <fieldset>
                  <FormField label='ARGS' htmlFor='arg'>
                    <textarea rows="3" type='text' id='arg' name='arg' onChange={this.valueChanged} value={this.state.data['ARG']}/>
                  </FormField>
                </fieldset>
              </FormFields> : ''
            }
            {
              this.state.selected.includes('FROM') ?
              <FormField label='FROM'>
                <TextInput name='from' onDOMChange={this.valueChanged} value={this.state.data['FROM']}/>
              </FormField> : ''
            }
            {
              this.state.selected.includes('LABEL') ?
              <FormFields>
                <fieldset>
                  <FormField label='LABEL' htmlFor='label'>
                    <textarea rows="3" type='text' id='label' name='label' onChange={this.valueChanged} value={this.state.data['LABEL'] || ''}/>
                  </FormField>
                </fieldset>
              </FormFields> : ''
            }
            {
              this.state.selected.includes('USER') ?
              <FormField label='USER'>
                <TextInput name='user' onDOMChange={this.valueChanged} value={this.state.data['USER'] || ''}/>
              </FormField> : ''
            }
            {
              this.state.selected.includes('SHELL') ?
              <FormField label='SHELL'>
                <TextInput name='shell' onDOMChange={this.valueChanged} value={this.state.data['SHELL'] || ''}/>
              </FormField> : ''
            }
            {
              this.state.selected.includes('WORKDIR') ?
              <FormField label='WORKDIR'>
                <TextInput name='workdir' onDOMChange={this.valueChanged} value={this.state.data['WORKDIR'] || ''}/>
              </FormField> : ''
            }
            {
              this.state.selected.includes('ADD') ?
              <FormFields>
                <fieldset>
                  <FormField label='ADD' htmlFor='add'>
                    <textarea rows="3" type='text' id='add' name='add' onChange={this.valueChanged} value={this.state.data['ADD'] || ''}/>
                  </FormField>
                </fieldset>
              </FormFields> : ''
            }
            {
              this.state.selected.includes('COPY') ?
              <FormFields>
                <fieldset>
                  <FormField label='COPY' htmlFor='copy'>
                    <textarea rows="3" type='text' id='copy' name='copy' onChange={this.valueChanged} value={this.state.data['COPY'] || ''}/>
                  </FormField>
                </fieldset>
              </FormFields> : ''
            }
            {
              this.state.selected.includes('RUN') ?
              <FormFields>
                <fieldset>
                  <FormField label='RUN' htmlFor='run'>
                    <textarea rows="3" type='text' id='run' name='run' onChange={this.valueChanged} value={this.state.data['RUN'] || ''}/>
                  </FormField>
                </fieldset>
              </FormFields> : ''
            }
            {
              this.state.selected.includes('EXPOSE') ?
              <FormFields>
                <fieldset>
                  <FormField label='EXPOSE' htmlFor='expose'>
                    <textarea rows="3" type='text' id='expose' name='expose' onChange={this.valueChanged} value={this.state.data['EXPOSE'] || ''}/>
                  </FormField>
                </fieldset>
              </FormFields> : ''
            }
            {
              this.state.selected.includes('ENV') ?
              <FormFields>
                <fieldset>
                  <FormField label='ENV' htmlFor='env'>
                    <textarea rows="3" type='text' id='env' name='env' onChange={this.valueChanged} value={this.state.data['ENV'] || ''}/>
                  </FormField>
                </fieldset>
              </FormFields> : ''
            }
            {
              this.state.selected.includes('VOLUME') ?
              <FormField label='VOLUME'>
                <TextInput name='volume' onDOMChange={this.valueChanged} value={this.state.data['VOLUME'] || ''}/>
              </FormField> : ''
            }
            {
              this.state.selected.includes('ENTRY POINT') ?
              <FormField label='ENTRY POINT'>
                <TextInput name='entry point' onDOMChange={this.valueChanged} value={this.state.data['ENTRY POINT'] || ''}/>
              </FormField> : ''
            }
            {
              this.state.selected.includes('ONBUILD') ?
              <FormFields>
                <fieldset>
                  <FormField label='ONBUILD' htmlFor='onbuild'>
                    <textarea rows="3" type='text' id='onbuild' name='onbuild' onChange={this.valueChanged} value={this.state.data['ONBUILD'] || ''}/>
                  </FormField>
                </fieldset>
              </FormFields> : ''
            }
            {
              this.state.selected.includes('STOP SIGNAL') ?
              <FormField label='STOP SIGNAL'>
                <TextInput name='stop signal' onDOMChange={this.valueChanged} value={this.state.data['STOP SIGNAL'] || ''}/>
              </FormField> : ''
            }
            {
              this.state.selected.includes('HEALTHCHECK') ?
              <FormField label='HEALTHCHECK'>
                <TextInput name='healthcheck' onDOMChange={this.valueChanged} value={this.state.data['HEALTHCHECK'] || ''}/>
              </FormField> : ''
            }
            {
              this.state.selected.includes('CMD') ?
              <FormField label='CMD'>
                <TextInput name='cmd' onDOMChange={this.valueChanged} value={this.state.data['CMD'] || ''}/>
              </FormField> : ''
            }
          </Box>
          <Box justify='start' align='center' full='vertical' basis='medium' pad={{ horizontal: 'medium' }}>
            <Select inline={true}
              multiple={true}
              options={['RUN', 'LABEL', 'ADD', 'COPY', 'ENTRY POINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD', 'STOP SIGNAL', 'HEALTHCHECK', 'SHELL']}
              value={this.state.selected}
              onChange={this.selectionChanged}
              className="inline-select" />
            <hr className='invisible'/>
            <Heading tag='h4' strong={true} margin='none'>Actions</Heading>
            <hr className='invisible'/>
            <Box direction='row' justify='center' colorIndex='light-2'>
              <Button icon={<Download />}
                box={true}
                onClick={this.buildDockerFile}
                plain={true}
                a11yTitle='Save'
                hoverIndicator={{background:'ok'}}
                className='btn-small' />
                <hr className='invisible'/>
                <Button icon={<Search />}
                box={true}
                onClick={this.togglePreview}
                a11yTitle='Preview'
                plain={true}
                className='btn-small'
                />
                <hr className='invisible'/>
                <Button icon={<Trash />}
                box={true}
                a11yTitle='Delete'
                onClick={this.deleteFile}
                hoverIndicator={{background:'critical'}}
                plain={true}
                className='btn-small'
                />
            </Box>
          </Box>
        </Box>
      </Box>
    )
  }
}

const mapStateToProps = state => ({
  selected: state.docker.build.images.fields,
  data: state.docker.build.images.data
});

const mapDispatchToProps = dispatch => ({ dispatch });

ImageBuildPage.contextTypes = {
  store: PropTypes.object
}

module.exports = connect(mapStateToProps, mapDispatchToProps)(ImageBuildPage);