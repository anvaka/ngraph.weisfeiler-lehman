module.exports.maybeIsomorphic = maybeIsomorphic;
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