import { execAction, getVolume } from '../services/volume'

let loopTree = (node, treeArry, treeLevelNodes) => {
  if (!node.children) {
    return
  }
  for (let i = 0; i < node.children.length; i += 1) {
    let item = node.children[i]
    node.childrenNode || (node.childrenNode = [])
    if (item === 'volume-head') {
      node.isVolumeLine = true
      node.childrenNode.push('volume-head')
      continue
    }
    let selected = treeArry.find(ele => ele.name === item)
    let child = {
      ...selected,
    }
    node.childrenNode.push(child)
    loopTree(child, treeArry, treeLevelNodes)
  }
  if (node.childrenNode) {
    node.childrenNode.sort((a, b) => {
      if (a === 'volume-head') {
        node.isVolumeLine = true
        return 1
      }
      if (b === 'volume-head') {
        node.isVolumeLine = true
        return -1
      }
      if (a.isVolumeLine || b.isVolumeLine) {
        node.isVolumeLine = true
      }
      return (new Date(a.created)).getTime() - (new Date(b.created)).getTime()
    })
    treeLevelNodes.push(node.childrenNode.map(el => {
      if (!el.name) {
        return el
      }
      return el.name
    }))
  }
}
let filterRemoved = (data) => {
  let filteredData = []
  for (let i = 0; i < data.length; i += 1) {
    let item = data[i]
    if (item.removed) {
      let parent = item.parent
      // change parent children
      if (parent !== '') {
        let parentEntity = data.find(el => el.name === parent)

        let pChildArray = parentEntity.children
        let itemPos = pChildArray.findIndex(ele => ele === item.name)
        pChildArray = pChildArray.slice(0, itemPos)
          .concat(pChildArray.slice(itemPos + 1, pChildArray.length))
          .concat(item.children)
        parentEntity.children = pChildArray
      }
      // change children parent
      for (let j = 0; j < item.children.length; j += 1) {
        let itemC = item.children[j]
        if (itemC === 'volume-head') {
          continue
        }
        let itemCEntity = data.find(el => el.name === itemC)
        itemCEntity.parent = parent
      }

      continue
    }
    filteredData.push(item)
  }
  return filteredData
}
export default (namespace) => {
  return {
    namespace,
    state: {
      volume: {},
      snapshotTree: [],
      // record nodes name of every Level
      treeLevelNodes: [],
      loading: false,
    },
    subscriptions: {

    },
    effects: {
      *snapshotAction({
        payload,
      }, { call, put }) {
        yield put({ type: 'setLoading', payload: true })
        yield call(execAction, payload.url, payload.params)
        if (payload.actions && payload.actions.length) {
          for (let i = 0; i < payload.actions.length; i += 1) {
            let item = payload.actions[i]
            yield call(execAction, item.url, item.params)
          }
        }
        yield put({ type: 'querySnapShot', payload: { url: payload.querySnapShotUrl } })
        yield put({ type: 'setLoading', payload: false })
      },
      *queryVolume({
        payload,
      }, { call, put }) {
        const data = yield call(getVolume, payload)
        yield put({ type: 'setVolume', payload: data })
        yield put({ type: 'querySnapShot', payload: { url: data.actions.snapshotList } })
      },
      *querySnapShot({
        payload,
      }, { call, put }) {
        if (!payload.url) {
          yield put({ type: 'setSnapshot', payload: [] })
          return
        }
        yield put({ type: 'setLoading', payload: true })
        const treeData = (yield call(execAction, payload.url)).data
        treeData.forEach(el => {
          const children = el.children
          if (children) {
            el.children = Object.keys(children)
          }
        })
        yield put({ type: 'setLoading', payload: false })
        let actualData = filterRemoved(treeData)
        let rootNodes = []
        for (let i = 0; i < actualData.length; i++) {
          let item = actualData[i]
          if (item.parent === '') {
            rootNodes.push({
              ...item,
            })
          }
        }
        let rootNode = {
          children: rootNodes.map(el => el.name),
        }
        let treeLevelNodes = []
        if (rootNodes.length) {
          loopTree(rootNode, actualData, treeLevelNodes)
          yield put({ type: 'setTreeLevelNodes', payload: treeLevelNodes })
          yield put({ type: 'setSnapshot', payload: rootNode.childrenNode })
        } else {
          yield put({ type: 'setSnapshot', payload: [] })
        }
      },
      *backup({
        payload,
      }, { call, put }) {
        yield put({ type: 'setLoading', payload: true })
        const snapshot = yield call(execAction, payload.snapshotCreateUrl, {})
        yield call(execAction, payload.snapshotBackupUrl, { name: snapshot.name })
        yield put({ type: 'querySnapShot', payload: { url: payload.querySnapShotUrl } })
        yield put({ type: 'setLoading', payload: false })
      },
    },
    reducers: {
      setSnapshot(state, action) {
        return {
          ...state,
          snapshotTree: action.payload,
        }
      },
      setLoading(state, action) {
        return {
          ...state,
          loading: action.payload,
        }
      },
      setVolume(state, action) {
        return {
          ...state,
          volume: action.payload,
        }
      },
      setTreeLevelNodes(state, { payload }) {
        return {
          ...state,
          treeLevelNodes: payload,
        }
      },
    },
  }
}
