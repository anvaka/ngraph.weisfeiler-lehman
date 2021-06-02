/**
 * This file contains set of utilities based on Weisfeiler-Lehman labeling
 * scheme.
 */

/**
 * Checks whether two graphs are potentially isomorphic. If it returns false
 * then the graph are not isomorphic. Otherwise, they may be isomorphic.
 */
module.exports.maybeIsomorphic = maybeIsomorphic;

/**
 * @typedef {Object} KernelInfo 
 * @property {ngraph.graph} graph
 * @property {number[]} kernel - graph's kernel
 * @property {string[]} prevLabels - labels computed on the previous step
 * @property {Map<string, number>} wordCount - counts how many times each word appeared on last iteration
 */

/**
 * Computes kernels for a set of graphs. Set of graphs share the same dictionary
 * for labels computation.
 * @param {ngraph.graph[]} graphs - list of graphs that share the dictionary
 * @param {number} iteration - how many steps should do it. Semantically, each new
 * iteration adds one more step to look beyond the neighbors.
 * 
 * @returns KernelInfo[]
 */
module.exports.getGraphsWLKernels = getGraphsWLKernels;

/**
 * Computes similarity of two graph kernels using cosine similarity
 */
module.exports.getGraphWLCosineSimilarity = getGraphWLCosineSimilarity;

/**
 * Computes similarity of two graph kernels using jaccard similarity
 */
module.exports.getGraphWLJaccardSimilarity = getGraphWLJaccardSimilarity;

/**
 * Performs one iteration of Weisfeiler Lehman labeling algorithm. It is best
 * explained in https://youtu.be/buzsHTa4Hgs?t=655
 */
module.exports.computeLabels = computeLabels;


function maybeIsomorphic(graphA, graphB) {
  if (graphA.getNodeCount() !== graphB.getNodeCount()) return false;
  if (graphA.getLinkCount() !== graphB.getLinkCount()) return false;

  let prevALabels, prevBLabels;

  for (let i = 0; i < graphA.getNodeCount(); ++i) {
    let aLabels = computeLabels(graphA, prevALabels);
    let bLabels = computeLabels(graphB, prevBLabels);

    let allALabels = aLabels.wordCount;
    let allBLabels = bLabels.wordCount;

    if (allBLabels.size !== allALabels.size) {
      return false;
    }

    let labelsAreTheSame = true;
    allALabels.forEach((count, word) => {
      if (allBLabels.get(word) !== count) {
        labelsAreTheSame = false;
      }
    });

    if (!labelsAreTheSame) return false; 
    if (prevALabels) {
      // we should only keep going if old and new labels have changed
      let labelsChanged = false;
      aLabels.labels.forEach((label, node) => {
        if (labelsChanged) return;
        if (prevALabels.get(node) !== label) labelsChanged = true;
      });
      bLabels.labels.forEach((label, node) => {
        if (labelsChanged) return;
        if (prevBLabels.get(node) !== label) labelsChanged = true;
      });

      if (!labelsChanged) {
        break;
      }
    }

    prevALabels = aLabels.labels;
    prevBLabels = bLabels.labels;
  }
  return true;
}

function getGraphWLCosineSimilarity(a, b, iterations) {
  const kernelsInfo = getGraphsWLKernels([a, b], iterations)
  return cosineSimilarity(kernelsInfo[0].kernel, kernelsInfo[1].kernel);
}

function getGraphWLJaccardSimilarity(a, b, iterations) {
  const kernelsInfo = getGraphsWLKernels([a, b], iterations)
  return jaccardSimilarity(kernelsInfo[0].kernel, kernelsInfo[1].kernel);
}

function getGraphsWLKernels(graphs, iterations) {
  const globalHistogramIndex = new Map();
  const dict = new Map();

  const workingSet = graphs.map(graph => ({
    graph,
    kernel: [],
    prevLabels: null,
    // Count of words on this iteration only
    wordCount: null
  }));

  for (let i = 0; i < iterations; ++i) {
    workingSet.forEach(item => {
      let {labels, wordCount} = computeLabels(item.graph, item.prevLabels, dict);
      addToGlobal(globalHistogramIndex, wordCount);
      item.wordCount = wordCount;
      item.prevLabels = labels;
    });

    updateKernels(workingSet, globalHistogramIndex);
  }

  return workingSet;
}

/**
 * Assigns index in the kernel vector for each word in a map of word counts
 */
function addToGlobal(keyToIndex, wordCounts) {
  wordCounts.forEach((count, word) => {
    if (keyToIndex.has(word)) return;
    keyToIndex.set(word, keyToIndex.size);
  });
}

function updateKernels(workingSet, indexLookup) {
  let unifiedLabels = new Set();

  // First we remember every single word we saw on this iteration:
  workingSet.forEach(item => {
    item.wordCount.forEach((v, k) => unifiedLabels.add(k));
  });

  // Now we update every kernel with new word counts (or old count changes):
  unifiedLabels.forEach(word => {
    // where is this word in the kernel vector?
    let index = indexLookup.get(word);
    workingSet.forEach(item => {
      let v = item.kernel;
      v[index] = (v[index] || 0) + item.wordCount.get(word) || 0;
    })
  });
}

function dot(a, b) {
  return a.reduce((s, c, i) => s + c * b[i], 0);
}

function cosineSimilarity(a, b) {
  return dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b));
}

function jaccardSimilarity(a, b) {
  let sharedCount = 0;
  let totalCount = 0;
  for (let i = 0; i < a.length; ++i) {
    // since each kernel dimension counts exactly the same label, we can assume these
    // labels are "shared" between two sets:
    sharedCount += Math.min(a[i], b[i])
    totalCount += a[i] + b[i];
  }
  return sharedCount/(totalCount - sharedCount);
}

function computeLabels(graph, prevLabels, dictionary) {
  let uncompressedLabels = new Map();

  if (!prevLabels) {
    prevLabels = new Map();
    graph.forEachNode(node => {
      prevLabels.set(node, '1');
    });
  }

  graph.forEachNode(node => {
    let neighbors = [];

    graph.forEachLinkedNode(node.id, neighbor => {
      neighbors.push(prevLabels.get(neighbor));
    });

    neighbors.sort();
    uncompressedLabels.set(node, neighbors);
  });

  let labels = new Map();
  if (!dictionary) dictionary = new Map();
  let wordCount = new Map();

  graph.forEachNode(node => {
    let hash = prevLabels.get(node) + uncompressedLabels.get(node).join('');

    let compressedKey = dictionary.get(hash);
    if (compressedKey === undefined) {
      compressedKey = '' + (dictionary.size + 1);
      dictionary.set(hash, compressedKey);
    }
    labels.set(node, compressedKey);
    wordCount.set(compressedKey, (wordCount.get(compressedKey) || 0) + 1);
  });

  return {labels, prevLabels, uncompressedLabels, wordCount, graph}
}