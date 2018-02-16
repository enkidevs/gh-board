import React from 'react'
import _ from 'underscore'
import { connect } from 'react-redux'
import { Link } from 'react-router'
import * as BS from 'react-bootstrap'
import classnames from 'classnames'
import {
  BeakerIcon,
  SyncIcon,
  LockIcon,
  RepoForkedIcon,
  RepoIcon,
  PersonIcon,
  OrganizationIcon,
} from 'react-octicons'

import { fetchRepositories, fetchRepo } from '../../redux/ducks/user'
import { goTo, selectors } from '../../redux/ducks/filter'
import AsyncButton from '../async-button'
import Time from '../time'

const SAMPLE_REPOS = [
  { repoOwner: 'huboard', repoName: 'huboard' },
  {
    repoOwner: 'openstax',
    repoNames: ['tutor-js', 'tutor-server'],
    comment: ' (multiple repositories)',
  },
  { repoOwner: 'jquery', repoName: 'jquery' },
]

const ListGroupWithMore = React.createClass({
  getInitialState() {
    return { morePressedCount: 0 }
  },
  onClickMore() {
    this.setState({ morePressedCount: this.state.morePressedCount + 1 })
  },
  render() {
    const { children } = this.props
    const { morePressedCount } = this.state
    const initial = 4 // Show 4 results initially
    const multiple = 10 // Add 10 results at a time
    let partialChildren
    if (initial + morePressedCount * multiple < children.length) {
      const moreButton = (
        <BS.ListGroupItem key="more" onClick={this.onClickMore}>
          {children.length - morePressedCount * multiple} more...
        </BS.ListGroupItem>
      )
      partialChildren = children.slice(0, initial + morePressedCount * multiple)
      partialChildren.push(moreButton)
    } else {
      partialChildren = children
    }
    return <BS.ListGroup>{partialChildren}</BS.ListGroup>
  },
})

const RepoItem = React.createClass({
  render() {
    const { repoOwner, comment, isSelected, onSelect } = this.props
    let { repoName, repoNames } = this.props

    // Example repos do not have additional information and may contain multiple repos
    let { repo } = this.props
    repo = repo || {}
    if (repoNames) {
      repoName = repoNames.join(' & ')
    } else {
      repoNames = [repoName]
    }
    const repoInfos = repoNames.map(name => {
      return { repoOwner, repoName: name }
    })

    let repoIcon
    if (repo.private) {
      repoIcon = <LockIcon className="repo-icon" />
    } else if (repo.fork) {
      repoIcon = <RepoForkedIcon className="repo-icon" />
    } else {
      repoIcon = <RepoIcon className="repo-icon" />
    }

    const classes = {
      'repo-item': true,
      'is-private': repo.private,
    }

    let updatedAt = null
    if (repo.pushedAt) {
      updatedAt = (
        <small className="repo-updated-at">
          {'updated '}
          <Time dateTime={repo.pushedAt} />
        </small>
      )
    }

    let multiSelectButton = null
    if (onSelect) {
      multiSelectButton = (
        <input
          className="pull-right"
          type="checkbox"
          checked={isSelected || false}
          onChange={onSelect}
        />
      )
    }

    const filters = new selectors.FilterBuilder(undefined, repoInfos)
    const repoLink = filters.url()
    return (
      <BS.ListGroupItem key={repoName} className={classnames(classes)}>
        {repoIcon}
        <Link to={repoLink}>{repoName}</Link>
        {(repo.private && (
          <BS.Label className="repo-private-label" bsStyle="warning">
            PRIVATE
          </BS.Label>
        )) ||
          null}{' '}
        {updatedAt}
        {comment}
        {multiSelectButton}
      </BS.ListGroupItem>
    )
  },
})

const RepoGroup = React.createClass({
  getInitialState() {
    return { selectedRepos: {} }
  },
  toggleSelect(repoName) {
    return () => {
      const { selectedRepos } = this.state
      if (selectedRepos[repoName]) {
        delete selectedRepos[repoName]
      } else {
        selectedRepos[repoName] = true
      }
      this.setState({ selectedRepos })
      // this.forceUpdate(); // since we are modifying the object directly
    }
  },
  render() {
    let { repoOwner, repos, index } = this.props
    const { selectedRepos } = this.state
    repos = _.sortBy(repos, ({ pushedAt: repoUpdatedAt }) => {
      return repoUpdatedAt
    })
    repos.reverse()

    const sortedRepoNodes = _.map(repos, repo => {
      const repoName = repo.name

      return (
        <RepoItem
          key={repoOwner + repoName}
          dispatch={this.props.dispatch}
          repoOwner={repoOwner}
          repoName={repoName}
          repo={repo}
          isSelected={selectedRepos[repoName]}
          onSelect={this.toggleSelect(repoName)}
        />
      )
    })

    let viewBoard = null
    if (Object.keys(selectedRepos).length) {
      const repoInfos = Object.keys(selectedRepos).map(repoName => {
        return { repoOwner, repoName }
      })
      const filters = new selectors.FilterBuilder(undefined, repoInfos)
      const repoLink = filters.url()
      viewBoard = (
        <BS.Button
          className="pull-right"
          bsStyle="primary"
          bsSize="xs"
          href={'/#' + repoLink}
        >
          View Board
        </BS.Button>
      )
    }

    let orgIcon
    if (this.props.user && this.props.user.login === repoOwner) {
      orgIcon = <PersonIcon className="org-icon" />
    } else {
      orgIcon = <OrganizationIcon className="org-icon" />
    }
    const header = (
      <span className="org-header">
        {orgIcon} {repoOwner}
        {viewBoard}
      </span>
    )

    return (
      <BS.Col md={6}>
        <BS.Panel key={repoOwner} header={header} eventKey={index}>
          <ListGroupWithMore>{sortedRepoNodes}</ListGroupWithMore>
        </BS.Panel>
      </BS.Col>
    )
  },
})

const Dashboard = React.createClass({
  render() {
    const { repos, user } = this.props

    const repoOwnersUpdatedAt = {}
    const reposByOwner = {}

    _.each(repos, repo => {
      const repoOwner = repo.owner.login
      const updatedAt = repo.pushedAt

      if (
        !repoOwnersUpdatedAt[repoOwner] ||
        repoOwnersUpdatedAt[repoOwner] < updatedAt
      ) {
        repoOwnersUpdatedAt[repoOwner] = updatedAt
      }
      if (!reposByOwner[repoOwner]) {
        reposByOwner[repoOwner] = []
      }
      reposByOwner[repoOwner].push(repo)
    })

    let sortedRepoOwners = _.map(
      repoOwnersUpdatedAt,
      (updatedAt, repoOwner) => {
        return { repoOwner, updatedAt }
      }
    )
    sortedRepoOwners = _.sortBy(sortedRepoOwners, ({ updatedAt }) => {
      return updatedAt
    })
    sortedRepoOwners.reverse()

    const repoOwnersNodes = _.map(
      sortedRepoOwners,
      ({ repoOwner /*,updatedAt*/ }, index) => {
        const groupRepos = reposByOwner[repoOwner]
        return (
          <RepoGroup
            dispatch={this.props.dispatch}
            user={user}
            key={repoOwner}
            repoOwner={repoOwner}
            repos={groupRepos}
            index={index}
          />
        )
      }
    )

    return <span>{repoOwnersNodes}</span>
  },
})

const CustomRepoModal = React.createClass({
  getInitialState() {
    return { customRepoName: null }
  },
  onCustomRepoChange(e) {
    this.setState({ customRepoName: e.currentTarget.value })
  },
  goToBoard(customRepoName) {
    const [repoOwner, repoName] = customRepoName.split('/')
    const repoInfos = [{ repoOwner, repoName }]
    this.props.dispatch(goTo({ repoInfos, pathname: 'kanban' }))
  },
  render() {
    const { customRepoName } = this.state
    // Make sure the repo contains a '/'
    const isInvalid = customRepoName && !/[^/]\/[^/]/.test(customRepoName)
    const isDisabled = !customRepoName || isInvalid
    return (
      <BS.Modal {...this.props}>
        <BS.Modal.Header closeButton>
          <BS.Modal.Title>
            <RepoIcon size="mega" className="repo-icon" />
            {' Choose your GitHub Repo'}
          </BS.Modal.Title>
        </BS.Modal.Header>
        <BS.Modal.Body className="modal-body">
          <p>Enter the repository owner and name:</p>
          <BS.FormControl
            type="text"
            placeholder="Example: philschatz/gh-board"
            bsStyle={(isInvalid && 'error') || null}
            onChange={this.onCustomRepoChange}
          />
        </BS.Modal.Body>
        <BS.Modal.Footer>
          <AsyncButton
            disabled={isDisabled}
            bsStyle="primary"
            waitingText="Checking..."
            action={() => this.props.dispatch(fetchRepo(customRepoName))}
            onResolved={() => this.goToBoard(customRepoName)}
            renderError={() => <span>Invalid Repo. Please try again.</span>}
          >
            Show Board
          </AsyncButton>
        </BS.Modal.Footer>
      </BS.Modal>
    )
  },
})

const ExamplesPanel = React.createClass({
  getInitialState() {
    return { showModal: false }
  },
  onClickMore() {
    this.setState({ showModal: true })
  },
  render() {
    const { showModal } = this.state
    const close = () => this.setState({ showModal: false })

    const examplesHeader = (
      <span className="examples-header">
        <BeakerIcon className="org-icon" />
        {' Example Boards of GitHub Repositories'}
      </span>
    )

    return (
      <BS.Panel key="example-repos" header={examplesHeader}>
        <BS.ListGroup>
          {_.map(SAMPLE_REPOS, props => (
            <RepoItem key={JSON.stringify(props)} {...props} />
          ))}
          <BS.ListGroupItem className="repo-item" onClick={this.onClickMore}>
            <RepoIcon className="repo-icon" />
            Choose your own...
          </BS.ListGroupItem>
          <CustomRepoModal
            dispatch={this.props.dispatch}
            show={showModal}
            container={this}
            onHide={close}
            dispatch={this.props.dispatch}
          />
        </BS.ListGroup>
      </BS.Panel>
    )
  },
})

const DashboardShell = React.createClass({
  getInitialState() {
    return { repos: null }
  },
  componentWillMount() {
    if (this.props.user && !this.props.user.repositories) {
      this.props.dispatch(fetchRepositories())
    }
  },
  render() {
    let { user, ready, dispatch } = this.props

    let myRepos

    if (ready) {
      myRepos = (
        <Dashboard
          repos={(user || {}).repositories || []}
          user={user}
          dispatch={dispatch}
        />
      )
    } else {
      myRepos = (
        <span className="custom-loading is-loading">
          <SyncIcon className="icon-spin" />
          {' Loading List of Repositories...'}
        </span>
      )
    }

    return (
      <BS.Grid fluid className="dashboard" data-org-count={myRepos.length}>
        <BS.Row>
          <BS.Col md={6}>
            <ExamplesPanel dispatch={dispatch} />
          </BS.Col>
          {myRepos}
        </BS.Row>
      </BS.Grid>
    )
  },
})

export default connect(state => {
  return {
    ready: state.user.ready,
    user: state.user.info,
  }
})(DashboardShell)
