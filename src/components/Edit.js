import React, { Component } from 'react'
import PropTypes from 'prop-types'

import Header from './header/Header'
import ViewMode from './header/ViewMode'
import { NewButton, PeersButton, NotificationsButton } from './header/buttons'
import EditorArea from './EditorArea'
import Status from './Status'
import DocViewer from './DocViewer'
import { toSnapshotUrl } from './SnapshotLink'
import Warning from './Warning'

class Edit extends Component {
  constructor (props) {
    super(props)

    this._backend = props.backend
    const { type, name, readKey, writeKey } = props.match.params

    this.state = {
      name: decodeURIComponent(name),
      type: type,
      documentText: '',
      status: 'offline',
      room: {},
      canEdit: !!writeKey,
      rawKeys: {
        read: readKey,
        write: writeKey
      },
      viewMode: 'both',
      snapshots: [],
      alias: window.localStorage.getItem('alias'),
      doc: null,
      isDebuggingEnabled: false
    }

    this.onViewModeChange = this.onViewModeChange.bind(this)
    this.onEditor = this.onEditor.bind(this)
    this.onEditorValueChange = this.onEditorValueChange.bind(this)
    this.onTakeSnapshot = this.onTakeSnapshot.bind(this)
    this.onAliasChange = this.onAliasChange.bind(this)
    this.onDebuggingStart = this.onDebuggingStart.bind(this)
    this.onDebuggingStop = this.onDebuggingStop.bind(this)
  }

  onViewModeChange (viewMode) {
    this.setState({ viewMode })
  }

  onEditor (nextEditor) {
    const { _editor: editor } = this
    const { doc } = this.state

    // Unbind current editor if we have a current editor and a document
    if (doc && editor) doc.unbindEditor(editor)

    // Save the reference to the editor so we can unbind later or so we can
    // bind if there's no doc available yet
    this._editor = nextEditor

    // Bind new editor if not null and we have a document
    if (doc && nextEditor) doc.bindEditor(nextEditor)
  }

  onEditorValueChange (documentText) {
    this.setState({ documentText })
  }

  async onTakeSnapshot () {
    const snapshot = await this.state.doc.snapshots.take()
    snapshot.createdAt = new Date().toISOString()
    this.setState(({ snapshots }) => ({ snapshots: [snapshot, ...snapshots] }))
    this.prefetchSnapshot(snapshot)
    this.storeSnapshot(snapshot)
  }

  loadSnapshots () {
    const key = `${this.state.name}-snapshots`
    const val = window.localStorage.getItem(key)
    if (!val) return []
    try {
      return JSON.parse(val)
    } catch (err) {
      console.log('Failed to load snapshots for pad', key, err)
      // bad data. clear out for a better future.
      window.localStorage.removeItem(key)
      return []
    }
  }

  storeSnapshot (snapshot) {
    const snapshots = this.loadSnapshots()
    const key = `${this.state.name}-snapshots`
    const val = JSON.stringify([snapshot, ...snapshots])
    window.localStorage.setItem(key, val)
  }

  // Prefetch snapshot from gateway to makes it load faster when user clicks a snap shot link
  async prefetchSnapshot (snapshot) {
    const url = toSnapshotUrl(snapshot)
    return window.fetch(url)
      .then((response) => {
        if (!response.ok) {
          throw new Error('Gateway response was not ok')
        }
      }).catch((err) => {
        console.log('Failed to pre-fetch snapshot', url, err)
      })
  }

  onAliasChange (alias) {
    this.setState({ alias })
    this.state.doc.peers.setPeerAlias(alias)
    // cache globally for other pads to be able to use
    window.localStorage.setItem('alias', alias)
  }

  onDebuggingStart () {
    if (!this.state.doc) {
      console.log('not started yet, try activating debugging after IPFS starts')
      return // early
    }
    if (!this._networkObserver) {
      this._networkObserver = this.state.doc.network.observe()
      this._networkObserver.on('received message', (fromPeer, message) => {
        console.log('received', {
          from: fromPeer,
          message
        })
      })
      this._networkObserver.on('sent message', (toPeer, message) => {
        console.log('sent', {
          to: toPeer,
          message
        })
      })
      this._networkObserver.on('peer joined', (peer) => {
        console.log('' + peer + ' joined')
      })
      this._networkObserver.on('peer left', (peer) => {
        console.log('' + peer + ' left')
      })
    } else {
      this._networkObserver.start()
    }
    console.log('debugging started')
    this.setState({isDebuggingEnabled: true})
  }

  onDebuggingStop () {
    console.log('debugging stopped')
    this._networkObserver.stop()
    this.setState({isDebuggingEnabled: false})
  }

  render () {
    const {
      name,
      type,
      // The editor contents is updated directly by peerpad-core.
      // `documentText` is a cache of the last value we received.
      documentText,
      rawKeys,
      status,
      canEdit,
      viewMode,
      snapshots,
      alias,
      isDebuggingEnabled
    } = this.state

    const {
      onEditor,
      onEditorValueChange,
      onViewModeChange,
      onTakeSnapshot,
      onDebuggingStart,
      onDebuggingStop
    } = this

    return (
      <div>
        <Warning />
        <Header>
          <div className='flex-auto'>
            {type === 'richtext' ? null : (
              <ViewMode mode={viewMode} onChange={onViewModeChange} />
            )}
          </div>
          <div className='mr2'>
            <Status status={status} />
          </div>
          <div>
            <span className='mr2'>
              <NewButton />
            </span>
            <span className='mr0'>
              <PeersButton peerGroup={this.state.doc && this.state.doc.peers} alias={alias} onAliasChange={this.onAliasChange} />
            </span>
            <span>
              <NotificationsButton />
            </span>
          </div>
        </Header>
        <div className='ph3'>
          <div className='mw8 center'>
            <div className='mb4 pb3 bb b--pigeon-post'>
              <div className='flex flex-row items-center'>
                <div className='flex-auto'>
                  <input
                    ref={(ref) => { this._titleRef = ref }}
                    type='text'
                    className='input-reset sans-serif bw0 f4 blue-bayox w-100 pa0'
                    placeholder='Document Title'
                    readOnly={!canEdit}
                    data-id='document-title-input'
                   />
                </div>
                <div className='dn f7 pigeon-post'>
                  <b className='fw5'>Last change:</b> today, 12:00AM
                </div>
              </div>
            </div>
            <EditorArea
              docName={name}
              docType={type}
              docKeys={rawKeys}
              viewMode={viewMode}
              onEditor={onEditor}
              onEditorValueChange={onEditorValueChange}
              snapshots={snapshots}
              onTakeSnapshot={onTakeSnapshot}
              docText={documentText}
              convertMarkdown={this.state.doc && this.state.doc.convertMarkdown.bind(this.state.doc)}
              onDebuggingStart={onDebuggingStart}
              onDebuggingStop={onDebuggingStop}
              isDebuggingEnabled={isDebuggingEnabled}
              />
          </div>
        </div>
      </div>
    )
  }

  async componentDidMount () {
    const docScript = await (await window.fetch('static/js/viewer.bundle.js')).text()

    if (!this._backend) {
      const PeerpadBackend = await import('peerpad-core')
      this._backend = new PeerpadBackend()
      this.props.onBackend(this._backend)
    }

    const doc = this._backend.createDocument({
      type: this.state.type, // TODO: make this variable
      name: this.state.name,
      readKey: this.state.rawKeys.read,
      writeKey: this.state.rawKeys.write,
      docViewer: DocViewer,
      docScript,
      alias: this.state.alias
    })

    this.setState({ doc })

    doc.on('error', (err) => {
      console.log(err)
      alert(err.message)
    })

    // Watch for out local ipfs node to come online.
    if (this._backend.network.hasStarted()) {
      this.setState({ status: 'online' })
    } else {
      this._backend.network.once('started', () => {
        this.onDebuggingStart() // activate debugging
        this.setState({ status: 'online' })
      })
    }

    await doc.start()

    this.maybeActivateEditor()

    // Bind the editor if we got an instance while the doc was starting
    if (this._editor) doc.bindEditor(this._editor)

    // Turn the doc title into a peer editable input.
    doc.bindTitle(this._titleRef)

    // ooh la la, show the live value in the tab title too.
    doc.bindTitle(window.document.getElementsByTagName('title')[0])

    // Pull snapshots array out of localStorage into state.
    const snapshots = this.loadSnapshots()
    this.setState({snapshots})
  }

  componentWillUnmount () {
    this.state.doc.stop()
    this._editor = null
  }

  maybeActivateEditor () {
    if (this._editor && this.state.canEdit) {
      switch(this.state.type) {
        case 'richtext':
          this._editor.enable()
          this._editor.focus()
          break
        default:
          this._editor.setOption('readOnly', false)
      }
    }
  }
}

Edit.propTypes = {
  backend: PropTypes.object,
  onBackend: PropTypes.func
}

export default Edit
