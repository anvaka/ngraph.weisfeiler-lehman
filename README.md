# ngraph.weisfeiler-lehman

This library includes set of utilities that can:

* Check if two graphs are maybe isomorphic
* Find Cosine similarity between two graphs
* Find Jaccard similarity between two graphs
* Compute Weisfeiler-Lehman kernels for a set of graphs

Metrics are based on Weisfeiler-Lehman labeling schema. The labeling
schema assigns each node a label based on its neighborhood. The algorithm
is very fast, and provides graph-level characteristic. The characteristic
can be used to compare similarity between graphs.

## Usage

Install the library:

```
npm install ngraph.weisfeiler-lehman --save
```

In the examples below each graph is an instance of [ngraph.graph](https://github.com/anvaka/ngraph.graph);

## Test if graphs are isomorphic

``` js
const {maybeIsomorphic} = require('ngraph.weisfeiler-lehman');

// Here `a` and `b` are instances of `ngraph.graph`
maybeIsomorphic(a, b); 

// This will return false if two graphs are not isomorphic for sure.
//
// The true value means that graphs are likely isomorphic. Be careful to not
// assume that the graphs are isomorphic: 
//
// https://arxiv.org/pdf/1101.5211.pdf - shows families of non-isomorphic 
// graphs that are `maybeIsomorphic() == true`
```

## Graph kernels

Kernel function determines a similarity between graphs. For a very good introduction
please refer to https://youtu.be/buzsHTa4Hgs?t=655

From the library's standpoint, we call `kernel` a vector that counts how many times
each label appeared between multiple graphs over `N` iterations of Weisfeiler-Lehman
labeling schema.

With each iteration, node collects labels information from more distance places of the 
graph.

``` js
const {computeLabels} = require('ngraph.weisfeiler-lehman');

// Just perform one iteration of the labeling:
let result = computeLabels(graph)

// This will return:
//  * result.labels: Map<node, string> - maps each node of the graph into compressed
//     label (a string).
//  * result.prevLabels: Map<node, string> - labels from the previous iteration. By
//     default this would a Map, that maps each node into the same label "1"
//  * result.uncompressedLabels: Map<node, string[]> - maps each node into array of
//     neighbors' labels from the previous iteration.
//  * result.wordCount: Map<string, number> - Maps each compressed label into count of
//     times the label appeared in the graph

// To compute the next iteration of the Weisfeiler-Lehman schema:
let next = computeLabels(graph, result.labels);

// Note: The next iteration here will use a new dictionary to compress the labels,
// potentially assigning the same labels from the previous iteration. If you want to
// distinguish labels between iterations, you need to pass a shared dictionary object
let sharedDictionary = new Map();
let previousLabels = null;
let sharedResult = null;
for (let i = 0; i < 4; ++i) {
  // shared dictionary will accumulate labels across iterations:
  sharedResult = computeLabels(graph, previousLabels, sharedDictionary);
  previousLabels = sharedResult.labels;
}
```

Once we have a vector of label counts, we can use it to characterize our graph, or even 
compare two graphs.

### Cosine similarity of the graphs

``` js
let {getGraphWLCosineSimilarity} = require('ngraph.weisfeiler-lehman');

// returns cosine similarity of labels after two iterations of the labeling schema
let similarity = getGraphWLCosineSimilarity(a, b, 2);

// Here similarity will be `1` if two graphs are identical, `0` if they are completely
// dissimilar (share no same label).
```

### Jaccard similarity of the graphs

I'd be surprised if this is a new idea, but I haven't seen it yet before in the context of
Weisfeiler-Lehman labeling schema. 

The idea here is that each dimension of the kernel vector can be considered as a set of 
shared labels between two graphs (smaller value), and thus we can apply Jaccard Similarity 
to determine distance based on labels co-occurrence in the kernel vector:

``` js
let {getGraphWLJaccardSimilarity} = require('ngraph.weisfeiler-lehman');

// returns cosine similarity of labels after two iterations of the labeling schema
let similarity = getGraphWLJaccardSimilarity(a, b, 2);

// Here similarity will be `1` if two graphs are identical, `0` if they are completely
// dissimilar (share no same label).
```

## Support

If you like my work, please consider becoming [a sponsor](https://www.patreon.com/anvaka). It
would help me to dedicate more time to building more cool projects 🤗

## License

MIT 
