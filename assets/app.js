/* D3 collapsible tree — pure SVG cards (Safari/iOS safe) */
(function () {
  const data = JSON.parse(document.getElementById("tree-data").textContent);
  const chart = document.getElementById("chart");
  const svg = d3.select("#svg");
  const KIND = {
    product: ["#14532d", "Продукт"],
    component: ["#2f6f4e", "Компонент"],
    material: ["#8a6d3b", "Материал"],
    process: ["#4b5563", "Процесс"],
    service: ["#6d5a8a", "Услуга"],
    energy: ["#a16207", "Энергия"],
    logistics: ["#0e7490", "Логистика"],
  };
  const MOBILE = window.innerWidth < 760;
  const NODE_W = MOBILE ? 200 : 264, ROOT_W = MOBILE ? 215 : 286;
  const NODE_H = MOBILE ? 58 : 64, ROOT_H = MOBILE ? 80 : 84;
  const DX = MOBILE ? 240 : 336, DY = MOBILE ? 66 : 74;

  document.getElementById("legend").innerHTML = Object.entries(KIND)
    .map(([k, v]) => `<span><i style="background:${v[0]}"></i>${v[1]}</span>`)
    .join("");

  const g = svg.append("g");
  const linkLayer = g.append("g").attr("class", "links");
  const nodeLayer = g.append("g").attr("class", "nodes");

  let uid = 0;
  const root = d3.hierarchy(data);
  root.descendants().forEach((d) => {
    d.uid = ++uid;
    if (d.depth >= 1 && d.children) { d._children = d.children; d.children = null; }
  });
  root.x0 = 0; root.y0 = 0;

  const allNodes = [];
  (function walk(d) {
    allNodes.push(d);
    (d.children || d._children || []).forEach(walk);
  })(root);
  const byId = new Map(allNodes.map((d) => [d.data.id, d]));

  const zoom = d3.zoom().scaleExtent([0.1, 2.2]).on("zoom", (e) => g.attr("transform", e.transform));
  svg.call(zoom).on("dblclick.zoom", null);

  const width = (d) => (d.depth === 0 ? ROOT_W : NODE_W);
  const height = (d) => (d.depth === 0 ? ROOT_H : NODE_H);

  function cut(s, n) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (s.length <= n) return s;
    let i = s.lastIndexOf(" ", n);
    if (i < n * 0.55) i = n - 1;
    return s.slice(0, i).replace(/[ ,;:.—-]+$/, "") + "…";
  }
  function wrap2(s, n) {
    s = String(s || "").replace(/\s+/g, " ").trim();
    if (s.length <= n) return [s, ""];
    let i = s.lastIndexOf(" ", n);
    if (i < n * 0.5) i = n;
    const a = s.slice(0, i).trim();
    const b = s.slice(i).trim();
    return [a, cut(b, n)];
  }

  function drawNode(sel, d) {
    const w = width(d), h = height(d), isRoot = d.depth === 0;
    const tier = String(d.data.tier ?? d.depth).padStart(2, "0");
    sel.classed("root", isRoot).classed("k-" + d.data.k, true);
    sel.append("rect").attr("class", "nrect")
      .attr("x", 0).attr("y", -h / 2).attr("width", w).attr("height", h).attr("rx", 9);
    if (!isRoot) {
      sel.append("rect").attr("class", "naccent")
        .attr("x", 1).attr("y", -h / 2 + 6).attr("width", 3).attr("height", h - 12)
        .attr("rx", 1.5).attr("fill", KIND[d.data.k][0]);
    }

    const titleMax = Math.floor((w - 24) / (isRoot ? 7.2 : 6.4));
    const subMax = Math.floor((w - 36) / 5.3);
    const titleLines = isRoot ? wrap2(d.data.t, titleMax) : [cut(d.data.t, titleMax), ""];
    const subLines = wrap2(d.data.s, subMax);

    sel.append("text").attr("class", "ntier").attr("x", w - 9).attr("y", isRoot ? -30 : -22)
      .attr("text-anchor", "end").text(tier);

    titleLines.forEach((line, i) => {
      if (!line) return;
      sel.append("text").attr("class", "ntitle").attr("x", 11)
        .attr("y", isRoot ? -18 + i * 14 : -12).text(line);
    });
    subLines.forEach((line, i) => {
      if (!line) return;
      sel.append("text").attr("class", "nsub").attr("x", 11)
        .attr("y", isRoot ? 12 + i * 13 : 4 + i * 12).text(line);
    });

    sel.append("title").text(d.data.sum || d.data.s || d.data.t);

    if (d._children || d.children) {
      const t = sel.append("g").attr("class", "tgl")
        .attr("transform", `translate(${w - 14},${isRoot ? 2 : 8})`);
      t.append("circle").attr("class", "tglc").attr("r", 9);
      t.append("text").attr("class", "tglt").attr("text-anchor", "middle").attr("dy", ".35em")
        .text(d.children ? "−" : "+");
    }
  }

  function linkPath(s, t) {
    const sx = s.y + width(s) + 2, sy = s.x;
    const tx = t.y - 2, ty = t.x;
    const mx = (sx + tx) / 2;
    return `M${sx},${sy}C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
  }

  const tree = d3.tree().nodeSize([DY, DX]);

  function update(source) {
    const treeData = tree(root);
    const nodes = treeData.descendants();
    const links = treeData.links();
    nodes.forEach((d) => { d.y = d.depth * DX; });

    const link = linkLayer.selectAll("path.link").data(links, (d) => d.target.uid);
    link.enter().append("path").attr("class", "link")
      .attr("d", () => linkPath({ x: source.x0, y: source.y0 }, { x: source.x0, y: source.y0 }))
      .merge(link).attr("d", (d) => linkPath(d.source, d.target));
    link.exit().remove();

    const node = nodeLayer.selectAll("g.ng").data(nodes, (d) => d.uid);
    const enter = node.enter().append("g").attr("class", "ng")
      .attr("transform", `translate(${source.y0},${source.x0})`)
      .each(function (d) { drawNode(d3.select(this), d); });
    const all = enter.merge(node).attr("transform", (d) => `translate(${d.y},${d.x})`);

    all.each(function (d) {
      const el = this;
      el.onclick = (ev) => {
        if (ev.target.closest(".tgl")) return;
        if (ev.defaultPrevented) return;
        if (window.__STANDALONE__) { location.hash = `#node/${d.data.id}`; return; }
        location.href = `nodes/${d.data.id}.html`;
      };
      const btn = el.querySelector(".tgl");
      if (btn) btn.onclick = (ev) => { ev.stopPropagation(); toggle(d); };
    });
    all.select(".tgl text").text((d) => (d.children ? "−" : "+"));

    node.exit().remove();

    nodes.forEach((d) => { d.x0 = d.x; d.y0 = d.y; });
    source.x0 = source.x; source.y0 = source.y;
  }

  function toggle(d) {
    if (d.children) { d._children = d.children; d.children = null; }
    else if (d._children) { d.children = d._children; d._children = null; }
    update(d);
    if (d.children) setTimeout(() => ensureVisible(d), 30);
  }

  function centerOn(d, k) {
    const w = chart.clientWidth || window.innerWidth;
    const h = chart.clientHeight || window.innerHeight - 160;
    const t = d3.zoomIdentity.translate(w * 0.34, h / 2).scale(k).translate(-d.y, -d.x);
    svg.call(zoom.transform, t);
  }
  function ensureVisible(d) {
    const t = d3.zoomTransform(svg.node());
    const x = t.applyX(d.y), y = t.applyY(d.x);
    const w = chart.clientWidth, h = chart.clientHeight;
    if (x < 40 || x > w - 90 || y < 60 || y > h - 40) centerOn(d, Math.min(1, t.k));
  }

  function fit() {
    const nodes = root.descendants();
    if (!nodes.length) return;
    const minX = d3.min(nodes, (d) => d.x) - NODE_H;
    const maxX = d3.max(nodes, (d) => d.x) + NODE_H;
    const minY = d3.min(nodes, (d) => d.y) - 20;
    const maxY = d3.max(nodes, (d) => d.y + width(d)) + 60;
    const w = chart.clientWidth || window.innerWidth;
    const h = chart.clientHeight || window.innerHeight - 160;
    if (!w || !h) return;
    const k = Math.min(1.1, 0.92 * Math.min(w / (maxY - minY), h / (maxX - minX)));
    const t = d3.zoomIdentity.translate(w / 2, h / 2).scale(k)
      .translate(-(minY + maxY) / 2, -(minX + maxX) / 2);
    svg.call(zoom.transform, t);
  }

  function fitTo(nodes) {
    if (!nodes.length) return;
    const pad = 90;
    const minY = d3.min(nodes, (d) => d.y) - 20;
    const maxY = d3.max(nodes, (d) => d.y + width(d)) + 20;
    const minX = d3.min(nodes, (d) => d.x) - 80;
    const maxX = d3.max(nodes, (d) => d.x) + 80;
    const w = chart.clientWidth || window.innerWidth;
    const h = chart.clientHeight || window.innerHeight - 160;
    const k = Math.min(1.15, Math.min((w - pad) / (maxY - minY), (h - pad) / (maxX - minX)));
    const t = d3.zoomIdentity.translate(w / 2, h / 2).scale(k)
      .translate(-(minY + maxY) / 2, -(minX + maxX) / 2);
    svg.call(zoom.transform, t);
  }

  const q = document.getElementById("q");
  const qcount = document.getElementById("qcount");
  function clearHits() {
    nodeLayer.selectAll("g.ng").classed("hit", false);
    qcount.textContent = "";
  }
  function search() {
    const v = q.value.trim().toLowerCase();
    if (v.length < 2) { clearHits(); return; }
    const hits = allNodes.filter((d) => (d.data.t + " " + (d.data.s || "") + " " + (d.data.sum || "")).toLowerCase().includes(v));
    if (!hits.length) { clearHits(); qcount.textContent = "0"; return; }
    hits.forEach((d) => {
      let p = d.parent;
      while (p) { if (p._children) { p.children = p._children; p._children = null; } p = p.parent; }
    });
    update(root);
    nodeLayer.selectAll("g.ng").classed("hit", false);
    nodeLayer.selectAll("g.ng").each(function (d) {
      if (hits.includes(d)) d3.select(this).classed("hit", true);
    });
    qcount.textContent = String(hits.length);
    centerOn(hits[0], 0.82);
  }
  let timer;
  q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(search, 260); });

  document.getElementById("expand").onclick = () => {
    allNodes.forEach((d) => { if (d._children) { d.children = d._children; d._children = null; } });
    update(root); setTimeout(fit, 30);
  };
  document.getElementById("collapse").onclick = () => {
    root.descendants().forEach((d) => { if (d.depth >= 1 && d.children) { d._children = d.children; d.children = null; } });
    update(root); setTimeout(fit, 30);
  };
  document.getElementById("fit").onclick = fit;
  document.querySelectorAll(".zoombar button").forEach((b) => {
    b.onclick = () => svg.transition().duration(200).call(zoom.scaleBy, b.dataset.z === "in" ? 1.35 : 1 / 1.35);
  });

  update(root);
  if (window.__STANDALONE__) {
    setTimeout(fit, 120);
    setTimeout(fit, 700);
  } else {
    setTimeout(() => {
      const id = decodeURIComponent(location.hash.replace("#", ""));
      if (id && byId.has(id)) {
        const d = byId.get(id);
        let p = d.parent;
        while (p) { if (p._children) { p.children = p._children; p._children = null; } p = p.parent; }
        update(root);
        setTimeout(() => {
          centerOn(d, 0.9);
          nodeLayer.selectAll("g.ng").filter((x) => x.data.id === id).classed("hit", true);
        }, 40);
      } else {
        fit();
        setTimeout(fit, 600);
      }
    }, 120);
  }
  window.__atlas = { fit, centerOn, byId };
})();
