import {createScene} from 'w-gl';
import LineCollection from './LineCollection';
import PointCollection from './PointCollection';
import MSDFTextCollection from './MSDFTextCollection';
import bus from './bus';
import getGraph from './getGraph';
import createLayout from 'ngraph.forcelayout';
import {computeLabels, getGraphWLKernel} from '../../../index';
import generate from 'ngraph.generators';
import fromDot from 'ngraph.fromdot';

export default function createGraphScene(canvas) {
  let drawLinks = true;

  // Since graph can be loaded dynamically, we have these uninitialized
  // and captured into closure. loadGraph will do the initialization
  let graph, layout;
  let scene, nodes, lines, text;

  let layoutSteps = 0; // how many frames shall we run layout?
  let rafHandle;

  let dict = new Map();
  let allGraphs = [];
  allGraphs.push(generate.grid(5, 5))
  // allGraphs.push(generate.path(4));
  allGraphs.push(generate.binTree(4));
  allGraphs.push(generate.wattsStrogatz(100, 4, 0.4));
  allGraphs.push(generate.wattsStrogatz(10, 4, 0.46));
  //allGraphs.push(generate.wattsStrogatz(10, 2, 0.5));

//   allGraphs.push(fromDot(`
// graph A {
//   a -> {b; c; d};
//   b -> c;
//   d -> {c; e; f};
// }`))

//   allGraphs.push(fromDot(`
// graph A {
//   a -> {b; c};
//   b -> {c; d};
//   d -> {e; c};
//   c -> f;
// }`));
  for (let i = 0; i < allGraphs.length - 1; ++i) {
    let from = allGraphs[i];
    for (let j = i + 1; j < allGraphs.length; ++j) {
      let to = allGraphs[j];
      let dist = getGraphWLKernel(from, to, 3);
      console.log(i, j, dist);

    }
  }
  // allGraphs.sort(byKernel);

  allGraphs = allGraphs.map(graph => {
    let layout = createLayout(graph, {
      timeStep: 0.5,
      springLength: 10,
      springCoefficient: 0.8,
      gravity: -12,
      dragCoefficient: 0.9,
    });
    for (let i = 0; i < 200; ++i) {
      layout.step();
    }
    return {graph, layout};
  })
  // loadGraph(getGraph());
  // bus.on('load-graph', loadGraph);

  renderAllGraphs();
  return {
    dispose,
    runLayout,
    WeisfeilerLehmanStep,
  };
  
  // function byKernel(a, b) {
  //   let cachedDist = getCachedDist(a, b);
  //   if (cachedDist !== undefined) return cachedDist;
  //   let dist = computeGraphDistance(a, b);
  //   setCachedDist(a, b, dist);
  //   return dist;
  // }

  function WeisfeilerLehmanStep() {
    allGraphs.forEach(obj => {
      let graph = obj.graph;
      let labels = obj.labels;
      let stepResults = computeLabels(graph, labels, dict)
      obj.prevLabels = stepResults.prevLabels;
      obj.labels = stepResults.labels;
      obj.uncompressedLabels = stepResults.uncompressedLabels;
    });
    drawGraph();
  }

  function runLayout(stepsCount) {
    layoutSteps += stepsCount;
  }

  function initScene() {
    let scene = createScene(canvas);
    scene.setClearColor(12/255, 41/255, 82/255, 1)
    let initialSceneSize = 40;
    scene.setViewBox({
      left:  -initialSceneSize,
      top:   -initialSceneSize,
      right:  initialSceneSize,
      bottom: initialSceneSize,
    });
    return scene;
  }

  function renderAllGraphs() {
    if (scene) {
      scene.dispose();
      scene = null
      cancelAnimationFrame(rafHandle);
    }
    scene = initScene();
    nodes = new PointCollection(scene.getGL(), {
      capacity: 1000
    });
    text = new MSDFTextCollection(scene.getGL());
    lines = new LineCollection(scene.getGL(), { capacity: 1000 });

    let dx = 0, dy = 0, bbox;
    allGraphs.forEach(({graph, layout}) => {
      bbox = layout.simulator.getBoundingBox();
      graph.forEachNode(node => {
        var point = getNodePosition(node.id, layout);
        let size = 1;
        if (node.data && node.data.size) {
          size = node.data.size;
        } else {
          if (!node.data) node.data = {};
          node.data.size = size;
        }
        node.ui = {size, position: [point.x, point.y, point.z || 0], color: node.data.color || 0x90f8fcff};
        node.uiId = nodes.add(node.ui);

        let fontSize = 2;
        text.addText({
          x: point.x,
          y: point.y,
          color: 0xffffffff,
          text: '' + node.id,
          fontSize,
        });
      });

      graph.forEachLink(link => {
        var from = getNodePosition(link.fromId, layout);
        var to = getNodePosition(link.toId, layout);
        var line = { from: [from.x, from.y, from.z || 0], to: [to.x, to.y, to.z || 0], color: 0xFFFFFFff };
        link.ui = line;
        link.uiId = lines.add(link.ui);
      });
      dx += (bbox.max_x - bbox.min_x) * 1.2;
    })

    scene.appendChild(lines);
    scene.appendChild(nodes);
    scene.appendChild(text);

    function getNodePosition(nodeId, layout) { 
      let {x, y} = layout.getNodePosition(nodeId);
      x -= bbox.min_x -  dx;
      y -= bbox.min_y - dy;
      return {x, y};
    }
  }

  function frame() {
    rafHandle = requestAnimationFrame(frame);

    if (layoutSteps > 0) {
      layoutSteps -= 1;
      layout.step();
    }
    drawGraph();
  }

  function drawGraph() {
    text.clear();
    let dx = 0, dy = 0, bbox;
    allGraphs.forEach(obj => {
      let {graph, layout, uncompressedLabels, labels, prevLabels} = obj;
      bbox = layout.simulator.getBoundingBox();
      graph.forEachNode(node => {
        let pos = getNodePosition(node.id, layout);
        let uiPosition = node.ui.position;
        uiPosition[0] = pos.x;
        uiPosition[1] = pos.y;
        uiPosition[2] = pos.z || 0;
        nodes.update(node.uiId, node.ui)

        if (uncompressedLabels && labels) {
          let fontSize = 2;
          let label = labels.get(node);
          text.addText({
            x: pos.x,
            y: pos.y,
            color: 0xffffffff,
            text: label,
            fontSize,
          });
          let prev = prevLabels.get(node) + ';' + uncompressedLabels.get(node).join(',')
          text.addText({
            x: pos.x,
            y: pos.y - fontSize,
            color: 0x888888ff,
            text: prev,
            fontSize: fontSize * 0.2,
          });
        }
      });

      if (drawLinks) {
        graph.forEachLink(link => {
          var fromPos = getNodePosition(link.fromId, layout);
          var toPos = getNodePosition(link.toId, layout);
          let {from, to} = link.ui;
          from[0] = fromPos.x; from[1] = fromPos.y; from[2] = fromPos.z || 0;
          to[0] = toPos.x; to[1] = toPos.y; to[2] = toPos.z || 0;
          lines.update(link.uiId, link.ui);
        })
      }
      dx += (bbox.max_x - bbox.min_x) * 1.2;
    });

    scene.renderFrame();

    function getNodePosition(nodeId, layout) { 
      let {x, y} = layout.getNodePosition(nodeId);
      x -= bbox.min_x -  dx;
      y -= bbox.min_y - dy;
      return {x, y};
    }
  }

  function dispose() {
    cancelAnimationFrame(rafHandle);

    scene.dispose();
  }
}