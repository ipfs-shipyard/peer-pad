import Diff from 'fast-diff'
import debounce from 'lodash.debounce'
import peerColor from './peer-color'

const DEBOUNCE_CUSOR_ACTIVITY_MS = 2000

const bindCodeMirror = (doc, titleEditor, editor) => {
  const thisPeerId = doc.app.ipfs._peerInfo.id.toB58String()
  let cursorGossip
  let titleCollab
  let initialised = false
  let editorLocked = false
  let markers = new Map()

  console.log('titleEditor:', titleEditor.addListener)

  const onCodeMirrorChange = (editor, change) => {
    if (!initialised || editorLocked) {
      return
    }

    editorLocked = true

    const diffs = Diff(doc.shared.value().join(''), editor.getValue())

    let pos = 0
    diffs.forEach((d) => {
      if (d[0] === 0) { // EQUAL
        pos += d[1].length
      } else if (d[0] === -1) { // DELETE
        const delText = d[1]
        for (let i = delText.length - 1; i >=0; i--) {
          try {
            doc.shared.removeAt(pos + i)
          } catch (err) {
            console.error(err)
            onStateChanged()
          }
        }
      } else { // INSERT
        d[1].split('').forEach((c) => {
          doc.shared.insertAt(pos, c)
          pos ++
        })
      }
    })

    editorLocked = false
  }

  editor.on('change', onCodeMirrorChange)

  const onStateChanged = () => {
    if (editorLocked) {
      return
    }

    const oldText = editor.getValue()
    const newText = doc.shared.value().join('')

    if (oldText === newText) {
      return
    }
    editorLocked = true

    const cursor = editor.getCursor()
    let cursorPos = editor.indexFromPos(cursor)

    const diffs = Diff(oldText, newText)
    let pos = 0
    diffs.forEach((d) => {
      const [op, text] = d
      if (op === 0) { // EQUAL
        pos += text.length
      } else if (op === -1) { // DELETE
        if (text.length) {
          const fromPos = editor.posFromIndex(pos)
          fromPos.external = true
          const toPos = editor.posFromIndex(pos + text.length)
          toPos.external = true
          editor.replaceRange('', fromPos, toPos)

          if (pos < cursorPos) {
            cursorPos -= text.length
          }
        }
      } else { // INSERT
        if (text.length) {
          const fromPos = editor.posFromIndex(pos)
          fromPos.external = true
          editor.replaceRange(text, fromPos)

          if (pos < cursorPos) {
            cursorPos += text.length
          }
        }
      }
    })
    editor.setCursor(editor.posFromIndex(cursorPos))
    editorLocked = false
  }

  doc.on('state changed', onStateChanged)

  editor.setValue(doc.shared.value().join(''))

  const onTitleStateChanged = () => {
    const oldTitle = titleEditor.value
    const newTitle = titleCollab.shared.value().join('')
    console.log('title changed to', newTitle)
    if (newTitle === oldTitle) {
      return
    }

    titleEditor.value = newTitle
  }

  doc.sub('title', 'rga').then((_titleCollab) => {
    titleCollab = _titleCollab
    titleCollab.on('state changed', onTitleStateChanged)
    const title = titleCollab.shared.value().join('')
    console.log('initial title is', title)
    titleEditor.value = title
  })

  const onTitleEditorChanged = () => {
    if (!titleCollab) {
      return
    }

    const oldTitle = titleCollab.shared.value().join('')
    const newTitle = titleEditor.value

    console.log('old title:', oldTitle)
    console.log('new title:', newTitle)

    const diffs = Diff(oldTitle, newTitle)
    console.log('diffs:', diffs)

    let pos = 0
    diffs.forEach((d) => {
      if (d[0] === 0) { // EQUAL
        pos += d[1].length
      } else if (d[0] === -1) { // DELETE
        const delText = d[1]
        for (let i = delText.length - 1; i >=0; i--) {
          try {
            titleCollab.shared.removeAt(pos + i)
          } catch (err) {
            console.error(err)
            onStateChanged()
          }
        }
      } else { // INSERT
        d[1].split('').forEach((c) => {
          titleCollab.shared.insertAt(pos, c)
          pos ++
        })
      }
    })
  }

  titleEditor.addEventListener('input', onTitleEditorChanged)

  const onCursorGossipMessage = (cursor, fromPeerId) => {
    console.log(`cursor of ${fromPeerId} changed to `, cursor)
    if (fromPeerId === thisPeerId) {
      return
    }

    const previousMarkers = markers.get(fromPeerId)
    if (previousMarkers) {
      previousMarkers.forEach((marker) => marker.clear())
    }

    const color = peerColor(fromPeerId)

    const [head, fromPos, toPos] = cursor

    const widget = getCursorWidget(head, color)

    const bookmark = editor.setBookmark(head, { widget })
    const range = editor.markText(fromPos, toPos, {
      css: `background-color: ${color}; opacity: 0.8`,
      title: fromPeerId
    })
    markers.set(fromPeerId, [bookmark, range])
  }

  doc.gossip('cursors').then((_cursorGossip) => {
    cursorGossip = _cursorGossip
    cursorGossip.on('message', onCursorGossipMessage)
  })

  const onEditorCursorActivity = () => {
    if (cursorGossip) {
      const cursor = [
        editor.getCursor('head'),
        editor.getCursor('from'),
        editor.getCursor('to')]
      console.log('local cursor activity:', cursor)
      cursorGossip.broadcast(cursor)
    }
  }

  editor.on('cursorActivity', debounce(onEditorCursorActivity, DEBOUNCE_CUSOR_ACTIVITY_MS))

  initialised = true

  return () => {
    // unbind
    doc.removeListener('state changed', onStateChanged)
    editor.off('change', onCodeMirrorChange)
    titleEditor.removeEventListener('input', onTitleEditorChanged)
    if (titleCollab) {
      titleCollab.removeListener('state changed', onTitleStateChanged)
    }
    editor.off('cursorActivity', onEditorCursorActivity)
    if (cursorGossip) {
      cursorGossip.removeListener('message', onCursorGossipMessage)
    }
  }

  function getCursorWidget (cursorPos, color) {
    const cursorCoords = editor.cursorCoords(cursorPos)
    const cursorElement = document.createElement('span')
    cursorElement.style.borderLeftStyle = 'solid'
    cursorElement.style.borderLeftWidth = '2px'
    cursorElement.style.borderLeftColor = color
    cursorElement.style.height = `${(cursorCoords.bottom - cursorCoords.top)}px`
    cursorElement.style.padding = 0
    cursorElement.style.zIndex = 0

    return cursorElement
  }
}

export default (doc, title, editor, type) => {
  if (type === 'markdown') {
    return bindCodeMirror(doc, title, editor)
  }

  throw new Error('unsupported type ' + type)
}

