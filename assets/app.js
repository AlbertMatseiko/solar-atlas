/* D3 collapsible tree for the supply-chain atlas */
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
  const NODE_H = MOBILE ? 52 : 62, DX = MOBILE ? 240 : 336, DY = MOBILE ? 58 : 70;

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

  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  function cardHTML(d) {
    const w = width(d);
    const tier = String(d.data.tier ?? d.depth).padStart(2, "0");
    return `<div class="node k-${d.data.k}${d.depth === 0 ? " root" : ""}" style="width:${w}px;min-height:${NODE_H}px">
      <div class="tag">${tier}</div>
      <div class="nt" title="${esc(d.data.sum || d.data.s || "")}">${esc(d.data.t)}</div>
      <div class="ns">${esc(d.data.s || "")}</div>
      ${d._children || d.children ? `<button class="tgl" title="свернуть/развернуть">${d.children ? "−" : "+"}</button>` : ""}
    </div>`;
  }

  function linkPath(s, t) {
    const sx = s.y + width(s) + 2, sy = s.x;
    const tx = t.y - 2, ty = t.x;
    const mx = (sx + tx) / 2;
    return `M${sx},${sy}C${mx},${sy} ${mx},${ty} ${tx},${ty}`;
  }

  const tree = d3.tree().nodeSize([DY, DX]);

  function update(source) {
    const duration = 320;
    const treeData = tree(root);
    const nodes = treeData.descendants();
    const links = treeData.links();
    nodes.forEach((d) => { d.y = d.depth * DX; });

    const link = linkLayer.selectAll("path.link").data(links, (d) => d.target.uid);
    const linkEnter = link.enter().append("path").attr("class", "link")
      .attr("d", () => linkPath({ x: source.x0, y: source.y0 }, { x: source.x0, y: source.y0 }));
    linkEnter.merge(link).transition().duration(duration).attr("d", (d) => linkPath(d.source, d.target));
    link.exit().transition().duration(duration).attr("opacity", 0)
      .attr("d", () => linkPath({ x: source.x, y: source.y }, { x: source.x, y: source.y })).remove();

    const node = nodeLayer.selectAll("g.ng").data(nodes, (d) => d.uid);
    const nodeEnter = node.enter().append("g").attr("class", "ng")
      .attr("transform", () => `translate(${source.y0},${source.x0})`).attr("opacity", 0);

    const fo = nodeEnter.append("foreignObject")
      .attr("class", "node-fo")
      .attr("width", (d) => width(d) + 4)
      .attr("height", NODE_H + 14)
      .attr("y", -(NODE_H + 14) / 2);
    fo.append("xhtml:div").attr("class", "node-wrap").html((d) => cardHTML(d));

    const all = nodeEnter.merge(node);
    all.transition().duration(duration).attr("opacity", 1)
      .attr("transform", (d) => `translate(${d.y},${d.x})`);

    all.each(function (d) {
      const el = this.querySelector(".node");
      if (!el) return;
      el.onclick = (ev) => {
        if (ev.target.closest(".tgl")) return;
        if (ev.defaultPrevented) return;
        if (window.__STANDALONE__) { location.hash = `#node/${d.data.id}`; return; }
        location.href = `nodes/${d.data.id}.html`;
      };
      const btn = el.querySelector(".tgl");
      if (btn) btn.onclick = (ev) => { ev.stopPropagation(); toggle(d); };
      const tgl = el.querySelector(".tgl");
      if (tgl) tgl.textContent = d.children ? "−" : "+";
    });

    node.exit().transition().duration(duration).attr("opacity", 0)
      .attr("transform", () => `translate(${source.y},${source.x})`).remove();

    nodes.forEach((d) => { d.x0 = d.x; d.y0 = d.y; });
    source.x0 = source.x; source.y0 = source.y;
  }

  function toggle(d) {
    if (d.children) { d._children = d.children; d.children = null; }
    else if (d._children) { d.children = d._children; d._children = null; }
    update(d);
    if (d.children) setTimeout(() => ensureVisible(d), 350);
  }

  function centerOn(d, k) {
    const w = chart.clientWidth, h = chart.clientHeight;
    const t = d3.zoomIdentity.translate(w * 0.34, h / 2).scale(k).translate(-d.y, -d.x);
    svg.transition().duration(450).call(zoom.transform, t);
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
    const maxY = d3.max(nodes, (d) => d.y + width(d)) + 30;
    const w = chart.clientWidth, h = chart.clientHeight;
    const k = Math.min(1.1, 0.92 * Math.min(w / (maxY - minY), h / (maxX - minX)));
    const t = d3.zoomIdentity.translate(w / 2, h / 2).scale(k)
      .translate(-(minY + maxY) / 2, -(minX + maxX) / 2);
    svg.transition().duration(500).call(zoom.transform, t);
  }

  function fitTo(nodes) {
    if (!nodes.length) return;
    const pad = 90;
    const minY = d3.min(nodes, (d) => d.y) - 20;
    const maxY = d3.max(nodes, (d) => d.y + width(d)) + 20;
    const minX = d3.min(nodes, (d) => d.x) - 80;
    const maxX = d3.max(nodes, (d) => d.x) + 80;
    const w = chart.clientWidth, h = chart.clientHeight;
    const k = Math.min(1.15, Math.min((w - pad) / (maxY - minY), (h - pad) / (maxX - minX)));
    const t = d3.zoomIdentity.translate(w / 2, h / 2).scale(k)
      .translate(-(minY + maxY) / 2, -(minX + maxX) / 2);
    svg.transition().duration(450).call(zoom.transform, t);
  }

  const q = document.getElementById("q");
  const qcount = document.getElementById("qcount");
  function clearHits() {
    nodeLayer.selectAll("div.node").classed("hit", false).classed("dim", false);
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
    setTimeout(() => {
      nodeLayer.selectAll("div.node").classed("hit", false).classed("dim", false);
      nodeLayer.selectAll("g.ng").each(function (d) {
        if (hits.includes(d)) d3.select(this).select("div.node").classed("hit", true);
      });
      qcount.textContent = String(hits.length);
      centerOn(hits[0], 0.82);
    }, 360);
  }
  let timer;
  q.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(search, 260); });

  document.getElementById("expand").onclick = () => {
    allNodes.forEach((d) => { if (d._children) { d.children = d._children; d._children = null; } });
    update(root); setTimeout(fit, 380);
  };
  document.getElementById("collapse").onclick = () => {
    root.descendants().forEach((d) => { if (d.depth >= 1 && d.children) { d._children = d.children; d.children = null; } });
    update(root); setTimeout(fit, 380);
  };
  document.getElementById("fit").onclick = fit;
  document.querySelectorAll(".zoombar button").forEach((b) => {
    b.onclick = () => svg.transition().duration(300).call(zoom.scaleBy, b.dataset.z === "in" ? 1.35 : 1 / 1.35);
  });

  update(root);
  if (window.__STANDALONE__) {
    setTimeout(fit, 120);
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
          nodeLayer.selectAll("g.ng").filter((x) => x.data.id === id)
            .select("div.node").classed("hit", true);
        }, 380);
      } else {
        fit();
      }
    }, 120);
  }
  window.__atlas = { fit, centerOn, byId };
})();
