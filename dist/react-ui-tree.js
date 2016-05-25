var React = require('react');
var ReactDOM = require('react-dom');
var Tree = require('./tree');
var Node = require('./node');

module.exports = React.createClass({
  displayName: 'UITree',

  propTypes: {
    tree: React.PropTypes.object.isRequired,
    paddingLeft: React.PropTypes.number,
    renderNode: React.PropTypes.func.isRequired,
    noDrag: React.PropTypes.bool,
    noDragClassNames: React.PropTypes.array
  },

  getDefaultProps: function getDefaultProps() {
    return {
      paddingLeft: 20,
      noDragClassNames: []
    };
  },

  getInitialState: function getInitialState() {
    return this.init(this.props);
  },

  componentWillReceiveProps: function componentWillReceiveProps(nextProps) {
    if (!this._updated) {
      this.setState(this.init(nextProps));
    } else {
      this._updated = false;
    }
  },

  shouldComponentUpdate: function shouldComponentUpdate(nextProps, nextState) {
    return !nextState.dragging.id;
  },

  init: function init(props) {
    var tree = new Tree(props.tree);

    tree.isNodeCollapsed = props.isNodeCollapsed;
    tree.renderNode = props.renderNode;
    tree.changeNodeCollapsed = props.changeNodeCollapsed;
    tree.updateNodesPosition();

    return {
      tree: tree,
      dragging: {
        id: null,
        x: null,
        y: null,
        w: null,
        h: null
      }
    };
  },

  getDraggingDom: function getDraggingDom() {
    var tree = this.state.tree;
    var dragging = this.state.dragging;

    if (dragging && dragging.id) {
      var draggingIndex = tree.getIndex(dragging.id);
      var draggingStyles = {
        top: dragging.y,
        left: dragging.x,
        width: dragging.w
      };

      return React.createElement('div', { className: 'm-draggable', style: draggingStyles }, React.createElement(Node, {
        tree: tree,
        index: draggingIndex,
        paddingLeft: this.props.paddingLeft
      }));
    }

    return null;
  },

  getClassNamesRecursive: function (node) {
    var foundAll = false,
        result = [node.className || ""],
        currentNode = node.parentNode;

    while (!foundAll) {
      if (currentNode.className.match(/m-tree/ig)) {
        foundAll = true;
      } else {
        result.push(currentNode.className || "");
        currentNode = currentNode.parentNode;
      }
    }

    return result.join(" ");
  },

  dragStart: function dragStart(id, dom, e) {
    var parentClassNames, mayDrag, noDragRx;

    noDragRx = new RegExp(this.props.noDragClassNames.join("|"), "gi");
    parentClassNames = this.getClassNamesRecursive(e.target);
    mayDrag = !parentClassNames.match(noDragRx);

    // As we do not want buttons to register drag events...
    if (mayDrag) {
      this.dragging = {
        id: id,
        w: dom.offsetWidth,
        h: dom.offsetHeight,
        x: dom.offsetLeft,
        y: dom.offsetTop
      };

      this._startX = dom.offsetLeft;
      this._startY = dom.offsetTop;
      this._offsetX = e.clientX;
      this._offsetY = e.clientY;
      this._start = true;

      this.boundDragHandler = this.drag.bind(this, dom);
      this.boundDragEndHandler = this.dragEnd.bind(this, dom);

      window.addEventListener('mousemove', this.boundDragHandler);
      window.addEventListener('mouseup', this.boundDragEndHandler);
    }
  },

  // oh
  drag: function drag(dragElement, evt) {
    if (this._start) {
      this.setState({
        dragging: this.dragging
      });

      this._start = false;
    }

    var tree = this.state.tree;
    var dragging = this.state.dragging;
    var paddingLeft = this.props.paddingLeft;
    var newIndex = null;
    var index = tree.getIndex(dragging.id);
    var collapsed = index.node.collapsed;

    var _startX = this._startX;
    var _startY = this._startY;
    var _offsetX = this._offsetX;
    var _offsetY = this._offsetY;

    var pos = {
      x: _startX + evt.clientX - _offsetX,
      y: _startY + evt.clientY - _offsetY
    };

    dragging.x = pos.x;
    dragging.y = pos.y;

    var diffX = dragging.x - paddingLeft / 2 - (index.left - 2) * paddingLeft;
    var diffY = dragging.y - dragging.h / 2 - (index.top - 2) * dragging.h;

    if (diffX < 0) {
      // left
      if (index.parent && !index.next) {
        newIndex = tree.move(index.id, index.parent, 'after');
      }
    } else if (diffX > paddingLeft) {
      // right
      if (index.prev && !tree.getIndex(index.prev).node.collapsed && !tree.getIndex(index.prev).node.leaf) {
        newIndex = tree.move(index.id, index.prev, 'append');
      }
    }

    if (newIndex) {
      index = newIndex;
      newIndex.node.collapsed = collapsed;
      dragging.id = newIndex.id;
    }

    if (diffY < 0) {
      // up
      var above = tree.getNodeByTop(index.top - 1);

      newIndex = tree.move(index.id, above.id, 'before');
    } else if (diffY > dragging.h) {
      // down
      if (index.next) {
        var below = tree.getIndex(index.next);

        if (below.children && below.children.length && !below.node.collapsed) {
          newIndex = tree.move(index.id, index.next, 'prepend');
        } else {
          newIndex = tree.move(index.id, index.next, 'after');
        }
      } else {
        var below = tree.getNodeByTop(index.top + index.height);

        if (below && below.parent !== index.id) {
          if (below.children && below.children.length) {
            newIndex = tree.move(index.id, below.id, 'prepend');
          } else {
            newIndex = tree.move(index.id, below.id, 'after');
          }
        }
      }
    }

    if (newIndex) {
      newIndex.node.collapsed = collapsed;
      dragging.id = newIndex.id;
    }

    this.updateDragElement(dragElement, {
      evt: evt,
      lastIndex: index,
      newIndex: newIndex,
      pos: pos
    });

    this.setState({
      tree: tree,
      dragging: dragging
    });
  },

  registerNode: function registerNode(nodeComponent) {
    if (!this._nodes) this._nodes = {};

    this._nodes[nodeComponent.props.index.id] = nodeComponent;
  },

  getNodeByIndex: function getNodeByIndex(index) {
    return (this._nodes || {})[index];
  },

  updateDragElement: function updateDragElement(dragElement, options) {
    var listNode, nodeAtNewIndex, placeholderNode;

    dragElement = dragElement.parentNode;
    placeholderNode = this.createPlaceholderNode(dragElement);

    if ((options.newIndex || {}).next) {
      dragElement.classList.add("hidden-until-drag-end");
      nodeAtNewIndex = ReactDOM.findDOMNode(this.getNodeByIndex(options.newIndex.next));
      listNode = nodeAtNewIndex.parentNode;

      listNode.insertBefore(placeholderNode, nodeAtNewIndex);
    }
  },

  createPlaceholderNode: function createPlaceholderNode(node) {
    var placeholderNode;

    function unReact() {
      for (var i = 0; i < arguments.length; i++) {
        if (arguments[i]) {
          if (typeof arguments[i].removeAttribute === "function") {
            arguments[i].removeAttribute("data-reactid");
          }
          unReact.apply(null, Array.prototype.slice.apply(arguments[i].childNodes));
        }
      }
    }

    if (!this._placeholderNode) {
      placeholderNode = node.cloneNode(true);
      placeholderNode.classList.add("placeholder");

      unReact(placeholderNode);
      this._placeholderNode = placeholderNode;
    }

    return this._placeholderNode;
  },

  clearPlaceholderNode: function clearPlaceholderNode() {
    if (this._placeholderNode) {
      this._placeholderNode.parentNode.removeChild(this._placeholderNode);
      this._placeholderNode = null;
    }
  },

  dragEnd: function dragEnd() {
    var tree = this.state.tree,
        dragging = this.state.dragging,
        index = tree.getIndex(dragging.id),
        previousIndex = tree.getIndex(index.prev),
        parentIndex = tree.getIndex(index.parent),
        node = index.node,
        previousNode = null,
        parentNode = null;

    if (previousIndex) {
      previousNode = previousIndex.node;
    }

    if (parentIndex) {
      parentNode = parentIndex.node;
    }

    this.clearPlaceholderNode();

    this.setState({
      dragging: {
        id: null,
        x: null,
        y: null,
        w: null,
        h: null
      }
    });

    this.change(parentNode, previousNode, node);
    window.removeEventListener('mousemove', this.boundDragHandler);
    window.removeEventListener('mouseup', this.boundDragEndHandler);
  },

  change: function change(parentNode, previousNode, node) {
    this._updated = true;

    if (this.props.onChange) {
      this.props.onChange(parentNode, previousNode, node);
    }
  },

  toggleCollapse: function toggleCollapse(nodeId) {
    var tree = this.state.tree;
    var index = tree.getIndex(nodeId);
    var node = index.node;
    node.collapsed = !node.collapsed;
    tree.updateNodesPosition();

    this.setState({
      tree: tree
    });

    this.change(tree);
  },

  render: function render() {
    var tree = this.state.tree;
    var dragging = this.state.dragging;
    var draggingDom = this.getDraggingDom();

    var dragStart = this.props.noDrag ? null : this.dragStart;

    return React.createElement('div', { className: 'm-tree' }, draggingDom, React.createElement(Node, {
      tree: tree,
      index: tree.getIndex(1),
      ref: "root",
      key: 1,
      paddingLeft: this.props.paddingLeft,
      onDragStart: dragStart,
      onCollapse: this.toggleCollapse,
      dragging: dragging && dragging.id,
      registerNode: this.registerNode
    }));
  }
});
