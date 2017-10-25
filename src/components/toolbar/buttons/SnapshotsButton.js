import React, { Component } from 'react'
import PropTypes from 'prop-types'
import Button from './Button'
import { SnapshotIcon } from '../../icons'
import { Dropleft, DropleftMenu } from '../../dropdown/Dropleft'

const GATEWAY_PREFIX = 'https://gateway.ipfs.io/ipfs'

export default class SnapshotsButton extends Component {
  constructor (props) {
    super(props)

    this.state = { dropleftMenuOpen: false }

    this.onDropleftTriggerClick = this.onDropleftTriggerClick.bind(this)
    this.onDropleftMenuDismiss = this.onDropleftMenuDismiss.bind(this)
  }

  onDropleftTriggerClick () {
    this.setState({ dropleftMenuOpen: true })
  }

  onDropleftMenuDismiss () {
    this.setState({ dropleftMenuOpen: false })
  }

  render () {
    const {
      onDropleftTriggerClick,
      onDropleftMenuDismiss
    } = this

    const { theme, onTakeSnapshot, snapshots } = this.props
    const { dropleftMenuOpen } = this.state

    return (
      <Dropleft>
        <Button theme={theme} icon={SnapshotIcon} title='Snapshots' onClick={onDropleftTriggerClick} />
        <DropleftMenu width={400} height={80} open={dropleftMenuOpen} onDismiss={onDropleftMenuDismiss}>
          <div className='pa4'>
            {snapshots.length ? (
              <ul className='list ma0 pa0'>
                {snapshots.map((ss) => {
                  console.log(ss)
                  const url = `${GATEWAY_PREFIX}/${ss.hash}/#${ss.key}`
                  return (
                    <li key={url} className='mb3'>
                      <small className='db mb1 f7 fw5 pigeon-post'>[timestamp]</small>
                      <a href={url}
                        className='f7 big-stone db code'
                        style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {ss.hash}
                      </a>
                    </li>
                  )
                })}
              </ul>
            ) : (
              <p className='f7 mt0 mb2 tc'>No snapshots taken</p>
            )}
            <div className='tc pt3'>
              <button type='button' className='button-reset f7 white-lilac bg-bright-turquoise hover--white ba b--bright-turquoise ph2 pv1 bw0 ttu pointer br1' onClick={onTakeSnapshot}>Take Snapshot</button>
            </div>
          </div>
        </DropleftMenu>
      </Dropleft>
    )
  }
}

SnapshotsButton.propTypes = {
  theme: PropTypes.oneOf(['light', 'dark']),
  onTakeSnapshot: PropTypes.func.isRequired,
  snapshots: PropTypes.array.isRequired
}