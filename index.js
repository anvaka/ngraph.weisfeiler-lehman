module.exports.maybeIsomorphic = maybeIsomorphic;
module.exports.computeLabels = computeLabels;
module.exports.getGraphWLKernel = getGraphWLKernel;

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

function getGraphWLKernel(a, b, iterations) {
  let dict = new Map();
  let prevA, prevB;
  let aVector = [];
  let bVector = [];
  let globalHistogramIndex = new Map();

  for (let i = 0; i < iterations; ++i) {
    let {labels: aLabels, wordCount: aWordCount} = computeLabels(a, prevA, dict);
    let {labels: bLabels, wordCount: bWordCount} = computeLabels(b, prevB, dict);
    prevA = aLabels;
    prevB = bLabels;
    addToGlobal(globalHistogramIndex, aWordCount);
    addToGlobal(globalHistogramIndex, bWordCount);

    appendToVector(aVector, aWordCount, bWordCount, globalHistogramIndex);
    appendToVector(bVector, bWordCount, aWordCount, globalHistogramIndex);
  }

  return similarity(aVector, bVector);
}

function addToGlobal(keyToIndex, keys) {
  keys.forEach((v, key) => {
    if (keyToIndex.has(key)) return;
    keyToIndex.set(key, keyToIndex.size);
  });
}

function appendToVector(v, found, other, indexLookup) {
  let unifiedLabels = new Set(found.keys());
  other.forEach((v, k) => unifiedLabels.add(k));
  Array.from(unifiedLabels).sort().forEach(k => {
    let index = indexLookup.get(k);
    v[index] = (v[index] || 0) + found.get(k) || 0;
  });
}

function dot(a, b) {
  return a.reduce((s, c, i) => s + c * b[i], 0);
}

function similarity(a, b) {
  return dot(a, b) / Math.sqrt(dot(a, a) * dot(b, b));
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

  return {labels, prevLabels, uncompressedLabels, wordCount}
}