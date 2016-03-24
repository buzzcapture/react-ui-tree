var cx = require('classnames');
var React = require('react');

var Node = React.createClass({
  displayName: 'UITreeNode',

  componentDidMount() {
    this.props.registerNode && this.props.registerNode(this);
  },

  renderCollapse() {
    var index = this.props.index;

    if (index.children && index.children.length) {
      var collapsed = index.node.collapsed;

      return React.createElement('span', { className: cx('collapse', collapsed ? 'caret-right' : 'caret-down'),
        onMouseDown: function (e) {
          e.stopPropagation();
        },
        onClick: this.handleCollapse });
    }

    return null;
  },

  renderChildren() {
    var index = this.props.index;
    var tree = this.props.tree;
    var dragging = this.props.dragging;
    var childrenStyles = {};

    if (index.children && index.children.length) {
      if (index.node.collapsed) {
        childrenStyles.display = 'none';
      }

      childrenStyles['paddingLeft'] = this.props.paddingLeft + 'px';

      return React.createElement(
        'div',
        { className: 'children',
          style: childrenStyles },
        index.children.map( function(child){
          var childIndex = tree.getIndex(child);

          return React.createElement(Node, { tree: tree,
            index: childIndex,
            key: childIndex.id,
            dragging: dragging,
            registerNode: this.props.registerNode,
            paddingLeft: this.props.paddingLeft,
            onCollapse: this.props.onCollapse,
            onDragStart: this.props.onDragStart });
        })
      );
    }

    return null;
  },

  render() {
    var tree = this.props.tree;
    var index = this.props.index;
    var dragging = this.props.dragging;
    var node = index.node;
    var styles = {};

    return React.createElement(
      'div',
      { className: cx('m-node', { 'placeholder': index.id === dragging }),
        style: styles },
      React.createElement(
        'div',
        { className: 'inner',
          ref: 'inner',
          onMouseDown: this.handleMouseDown,
          onMouseUp: this.handleMouseUp },
        this.renderCollapse(),
        tree.renderNode(node)
      ),
      this.renderChildren()
    );
  },

  handleCollapse(e) {
    var nodeId = this.props.index.id;

    e.stopPropagation();

    if (this.props.onCollapse) {
      this.props.onCollapse(nodeId);
    }
  },

  handleMouseDown(e) {
    var nodeId = this.props.index.id;
    var dom = this.refs.inner.getDOMNode();
    var evt = Object.assign({}, e);

    this.dragDelay = setTimeout(function () {
      if (this.props.onDragStart) {
        this.props.onDragStart(nodeId, dom, evt);
      }

      this.dragDelay = null;
    }.bind(this), 200);
  },

  handleMouseUp() {
    if (this.dragDelay) {
      clearTimeout(this.dragDelay);
    }
  }
});

module.exports = Node;
