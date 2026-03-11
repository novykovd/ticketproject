export class RTree {
    constructor(maxEntries = 8) {
        this.maxEntries = maxEntries
        this.minEntries = Math.ceil(maxEntries / 2)
        this.root = new Node(true)
    }

    chooseSubtree(node, rect) {
        if (node.leaf) return node

        let best = null
        let bestEnlargement = Infinity
        let bestArea = Infinity

        for (let entry of node.entries) {
            const e = enlargement(entry.mbr, rect)
            const a = area(entry.mbr)

            if (
            e < bestEnlargement ||
            (e === bestEnlargement && a < bestArea)
            ) {
            best = entry
            bestEnlargement = e
            bestArea = a
            }
        }

        return this.chooseSubtree(best.child, rect)
    }

    adjustTree(node) {
        while (node) {
            if (node.entries.length > this.maxEntries) {
            const [n1, n2] = this.splitNode(node)

            if (!node.parent) {
                const newRoot = new Node(false)

                newRoot.entries.push({
                mbr: this.computeMBR(n1),
                child: n1
                })

                newRoot.entries.push({
                mbr: this.computeMBR(n2),
                child: n2
                })

                n1.parent = newRoot
                n2.parent = newRoot
                this.root = newRoot
                return
            }

            const parent = node.parent

            parent.entries = parent.entries.filter(e => e.child !== node)

            parent.entries.push({
                mbr: this.computeMBR(n1),
                child: n1
            })

            parent.entries.push({
                mbr: this.computeMBR(n2),
                child: n2
            })

            n1.parent = parent
            n2.parent = parent

            node = parent
            } else {
            if (node.parent) {
                const entry = node.parent.entries.find(e => e.child === node)
                entry.mbr = this.computeMBR(node)
            }

            node = node.parent
            }
        }
    }

    insert(rect, obj) {
        const leaf = this.chooseSubtree(this.root, rect)

        leaf.entries.push({
        mbr: rect,
        child: obj
        })

        this.adjustTree(leaf)
    }

    computeMBR(node) {
        let r = node.entries[0].mbr

        for (let i = 1; i < node.entries.length; i++) {
            r = union(r, node.entries[i].mbr)
        }

        return r
    }

    pickSeeds(entries) {
        let maxWaste = -Infinity
        let seed1 = null
        let seed2 = null

        for (let i = 0; i < entries.length; i++) {
        for (let j = i + 1; j < entries.length; j++) {
            const a = entries[i].mbr
            const b = entries[j].mbr

            const waste = area(union(a, b)) - area(a) - area(b)

            if (waste > maxWaste) {
            maxWaste = waste
            seed1 = entries[i]
            seed2 = entries[j]
            }
        }
        }

        return [seed1, seed2]
    }

    splitNode(node) {
        const entries = [...node.entries]

        const [seed1, seed2] = this.pickSeeds(entries)

        const n1 = new Node(node.leaf)
        const n2 = new Node(node.leaf)

        n1.entries.push(seed1)
        n2.entries.push(seed2)

        entries.splice(entries.indexOf(seed1), 1)
        entries.splice(entries.indexOf(seed2), 1)

        while (entries.length) {
        const entry = entries.pop()

        const mbr1 = this.computeMBR(n1)
        const mbr2 = this.computeMBR(n2)

        const e1 = enlargement(mbr1, entry.mbr)
        const e2 = enlargement(mbr2, entry.mbr)

        if (e1 < e2) {
            n1.entries.push(entry)
        } else {
            n2.entries.push(entry)
        }
        }

        return [n1, n2]
    }

    getAllRectangles() {
        const rects = []

        function traverse(node) {
        for (const entry of node.entries) {
            rects.push(entry.mbr)

            if (!node.leaf) {
            traverse(entry.child)
            }
        }
        }

        traverse(this.root)

        return rects
    }

    knn(q, k) {
        const best = []

        const search = (node) => {

            for (const entry of node.entries) {

                const rectDist = rectRectDistance(q, entry.mbr)

                if (best.length === k && rectDist > best[best.length-1].dist) {
                    continue
                }

                if (node.leaf) {

                    const d = rectCenterDistance(q, entry.mbr)

                    best.push({
                        obj: entry.child,
                        dist: d
                    })

                    best.sort((a,b)=>a.dist-b.dist)

                    if (best.length > k) {
                        best.pop()
                    }

                } else {

                    search(entry.child)

                }

            }

        }

        search(this.root)

        return best
    }

}

class Node {
  constructor(leaf = false) {
    this.leaf = leaf
    this.entries = []
    this.parent = null
  }
}

function area(r) {
  return (r.maxX - r.minX) * (r.maxY - r.minY)
}

function union(a, b) {
  return {
    minX: Math.min(a.minX, b.minX),
    minY: Math.min(a.minY, b.minY),
    maxX: Math.max(a.maxX, b.maxX),
    maxY: Math.max(a.maxY, b.maxY)
  }
}

function enlargement(a, b) {
  return area(union(a, b)) - area(a)
}

function rectRectDistance(a, b) {

  const dx =
    a.maxX < b.minX ? b.minX - a.maxX :
    b.maxX < a.minX ? a.minX - b.maxX :
    0

  const dy =
    a.maxY < b.minY ? b.minY - a.maxY :
    b.maxY < a.minY ? a.minY - b.maxY :
    0

  return Math.sqrt(dx*dx + dy*dy)
}

function rectCenterDistance(a, b) {
    const ax = (a.minX + a.maxX) / 2;
    const ay = (a.minY + a.maxY) / 2;

    const bx = (b.minX + b.maxX) / 2;
    const by = (b.minY + b.maxY) / 2;

    const dx = ax - bx;
    const dy = ay - by;

    return Math.sqrt(dx * dx + dy * dy);
}