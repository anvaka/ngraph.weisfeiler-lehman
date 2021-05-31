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
import createGraph from 'ngraph.graph';
import {geoMercator} from 'd3-geo';
import BoundingBox from './BoundingBox';

const areaServer = 'https://city-roads.s3-us-west-2.amazonaws.com/nov-02-2020';

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
  let seattle = '3600237385'
  Promise.all([loadRoads(seattle),
     //loadRoads('3602456176'),
     //loadRoads('3601582777'),
     // loadRoads('3600344953'),


    ]).then(res => {
    allGraphs = res;
    renderAllGraphs();
  })

  return {
    dispose,
    runLayout,
    WeisfeilerLehmanStep,
  };

  function loadRoads(areaId) {
    return fetch(areaServer + '/' + areaId + '.pbf', {
      mode: 'cors'
    }).then(res => res.arrayBuffer()).then(byteArray => {
      var Pbf = require('pbf');
      var place = require('./place.js').place;
      var pbf = new Pbf(byteArray);
      var obj = place.read(pbf);
      let graph = createGraph();
      let bounds = new BoundingBox();
      obj.nodes.forEach(node => {
        bounds.addPoint(node.lon, node.lat);
      });
      let projector = geoMercator();
      projector.center([bounds.cx, bounds.cy]).scale(6371393); // Radius of the Earth
      let xyBounds = new BoundingBox();
      obj.nodes.forEach(node => {
        let pos = projector([node.lon, node.lat]);
        pos[1] *= -1;
        xyBounds.addPoint(pos[0], pos[1]);
        graph.addNode(node.id, { pos: pos });
      });
      obj.ways.forEach((way) => {
        way.nodes.forEach((_, idx, arr) => {
          if (idx == 0) return;
          let from = arr[idx - 1];
          let to = arr[idx];
          if (graph.hasLink(from, to)) return;
          if (graph.hasLink(to, from)) return;
          graph.addLink(from, to);
        })
      })

      return {
        graph: graph,
        bounds: xyBounds
      }
    })
  }

  function WeisfeilerLehmanStep() {
    let totalWords = new Set();
    allGraphs.forEach(obj => {
      let graph = obj.graph;
      let labels = obj.labels;
      let stepResults = computeLabels(graph, labels, dict)
      obj.prevLabels = stepResults.prevLabels;
      obj.labels = stepResults.labels;
      obj.uncompressedLabels = stepResults.uncompressedLabels;
      obj.wordCount = stepResults.wordCount;
      stepResults.wordCount.forEach((v, word) => totalWords.add(word));
    });

    totalWords = Array.from(totalWords).map(x => Number.parseInt(x, 10)).sort((a, b) => a - b);
    drawGraph(totalWords);
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
    lines = new LineCollection(scene.getGL(), { width: 2 });

    let dx = 0, dy = 0;
    allGraphs.forEach(({graph, bounds}) => {
      let bbox = bounds;
      graph.forEachNode(node => {
        var point = getNodePosition(node.id, graph, bbox);
        let size = 5;
        if (node.data && node.data.size) {
          size = node.data.size;
        } else {
          if (!node.data) node.data = {};
          node.data.size = size;
        }
        node.ui = {size, position: [point.x, point.y, 0], color: node.data.color || 0x90f8fcff};
        node.uiId = nodes.add(node.ui);

        // let fontSize = 2;
        // text.addText({
        //   x: point.x,
        //   y: point.y,
        //   color: 0xffffffff,
        //   text: '' + node.id,
        //   fontSize,
        // });
      });

      graph.forEachLink(link => {
        var from = getNodePosition(link.fromId, graph, bbox);
        var to = getNodePosition(link.toId, graph, bbox);
        var line = { from: [from.x, from.y, 0], to: [to.x, to.y,0], color: 0xFFFFFF30 };
        link.ui = line;
        link.uiId = lines.add(link.ui);
      });
      dx += (bbox.maxX - bbox.minX) * 1.2;
    })

    scene.appendChild(lines);
    scene.appendChild(nodes);
    scene.appendChild(text);

    function getNodePosition(nodeId, graph, bbox) { 
      let node = graph.getNode(nodeId);
      let pos = node.data.pos;
      let x = pos[0], y = pos[1];
      x -= bbox.minX - dx;
      y -= bbox.minY - dy - bbox.cy;
      return {x, y};
    }
  }

  function HSVtoRGB(h, s, v) {
    var r, g, b, i, f, p, q, t;
    if (arguments.length === 1) {
        s = h.s, v = h.v, h = h.h;
    }
    i = Math.floor(h * 6);
    f = h * 6 - i;
    p = v * (1 - s);
    q = v * (1 - f * s);
    t = v * (1 - (1 - f) * s);
    switch (i % 6) {
        case 0: r = v, g = t, b = p; break;
        case 1: r = q, g = v, b = p; break;
        case 2: r = p, g = v, b = t; break;
        case 3: r = p, g = q, b = v; break;
        case 4: r = t, g = p, b = v; break;
        case 5: r = v, g = p, b = q; break;
    }
    return {
        r: Math.round(r * 255),
        g: Math.round(g * 255),
        b: Math.round(b * 255)
    };
  }

  function getNodeColor(v, min, max) {
    v = Number.parseInt(v, 10);
    let h = (v - min)/(max - min);
    let rgb = HSVtoRGB(h, 1, 1);
    return (rgb.r << 24) | (rgb.g << 16) | (rgb.b << 8) | 0xff
  }

  function drawGraph(words) {
    text.clear();
    let minW = words[0];
    let maxW = words[words.length - 1];
    let dx = 0, dy = 0, bbox;
    allGraphs.forEach(obj => {
      let {graph, bounds: bbox, uncompressedLabels, labels, prevLabels} = obj;
      graph.forEachNode(node => {
        let pos = getNodePosition(node.id, graph, bbox);
        let uiPosition = node.ui.position;
        uiPosition[0] = pos.x;
        uiPosition[1] = pos.y;
        uiPosition[2] =  0;
        node.ui.color = getNodeColor(labels.get(node), minW, maxW);

        nodes.update(node.uiId, node.ui)

        // if (uncompressedLabels && labels) {
        //   let fontSize = 2;
        //   let label = labels.get(node);
        //   text.addText({
        //     x: pos.x,
        //     y: pos.y,
        //     color: 0xffffffff,
        //     text: label,
        //     fontSize,
        //   });
        //   let prev = prevLabels.get(node) + ';' + uncompressedLabels.get(node).join(',')
        //   text.addText({
        //     x: pos.x,
        //     y: pos.y - fontSize,
        //     color: 0x888888ff,
        //     text: prev,
        //     fontSize: fontSize * 0.2,
        //   });
        // }
      });

      if (drawLinks) {
        graph.forEachLink(link => {
          var fromPos = getNodePosition(link.fromId, graph, bbox);
          var toPos = getNodePosition(link.toId, graph, bbox);
          let {from, to} = link.ui;
          from[0] = fromPos.x; from[1] = fromPos.y; from[2] = fromPos.z || 0;
          to[0] = toPos.x; to[1] = toPos.y; to[2] = toPos.z || 0;
          lines.update(link.uiId, link.ui);
        })
      }
      dx += (bbox.maxX - bbox.minX) * 1.2;
    });

    scene.renderFrame();

    function getNodePosition(nodeId, graph, bbox) { 
      let node = graph.getNode(nodeId);
      let pos = node.data.pos;
      let x = pos[0], y = pos[1];
      x -= bbox.minX - dx;
      y -= bbox.minY - dy - bbox.cy;
      return {x, y};
    }
  }

  function dispose() {
    cancelAnimationFrame(rafHandle);

    scene.dispose();
  }
}