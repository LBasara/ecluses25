importScripts("https://cdn.jsdelivr.net/pyodide/v0.28.2/full/pyodide.js");

function sendPatch(patch, buffers, msg_id) {
  self.postMessage({
    type: 'patch',
    patch: patch,
    buffers: buffers
  })
}

async function startApplication() {
  console.log("Loading pyodide...");
  self.postMessage({type: 'status', msg: 'Loading pyodide'})
  self.pyodide = await loadPyodide();
  self.pyodide.globals.set("sendPatch", sendPatch);
  console.log("Loaded pyodide!");
  const data_archives = [];
  for (const archive of data_archives) {
    let zipResponse = await fetch(archive);
    let zipBinary = await zipResponse.arrayBuffer();
    self.postMessage({type: 'status', msg: `Unpacking ${archive}`})
    self.pyodide.unpackArchive(zipBinary, "zip");
  }
  await self.pyodide.loadPackage("micropip");
  self.postMessage({type: 'status', msg: `Installing environment`})
  try {
    await self.pyodide.runPythonAsync(`
      import micropip
      await micropip.install(['https://cdn.holoviz.org/panel/wheels/bokeh-3.8.0-py3-none-any.whl', 'https://cdn.holoviz.org/panel/1.8.2/dist/wheels/panel-1.8.2-py3-none-any.whl', 'pyodide-http']);
    `);
  } catch(e) {
    console.log(e)
    self.postMessage({
      type: 'status',
      msg: `Error while installing packages`
    });
  }
  console.log("Environment loaded!");
  self.postMessage({type: 'status', msg: 'Executing code'})
  try {
    const [docs_json, render_items, root_ids] = await self.pyodide.runPythonAsync(`\nimport asyncio\n\nfrom panel.io.pyodide import init_doc, write_doc\n\ninit_doc()\n\nimport panel as pn\nimport json\n\npn.extension(design='material', global_css=[':root { --design-primary-color: red; }'])\n\n\nwith open("sorted_dic_all.json", "r") as file:\n    dossard2urls=json.load(file)\n\ninfos= """\nBonjour \U0001f44b\nJe m'appelle Laurent Basara, vous pouvez me contacter \n[sur LinkedIn](https://www.linkedin.com/in/laurent-basara-6567a222a/).\n\nComme j'aime les d\xe9fis improbables,\nle 28 septembre dernier j'ai particip\xe9 \xe0 mon premier marathon,\nle marathon des \xc9cluses, \xe0 Laval (que j'ai d'ailleurs termin\xe9 en 4h00 \U0001f60e).\n\nComme j'avais du mal \xe0 trouver mes photos\n[sur le site officiel](https://marathondesecluses53.org/photos-edition-2025/),\nj'ai d\xe9cid\xe9 de bricoler un logiciel identifiant les dossards de chaque photo,\net permettant de filtrer celles correspondant \xe0 tout ou partie d'un num\xe9ro de dossard.\n\nComme je me suis dit que \xe7a pourrait \xeatre utile \xe0 d'autres, je partage ledit bout de code comme tableau de bord.\nIl va de soi qu'il n'y a aucune garantie sur le fait que l'identification soit correcte ou exhaustive.\nJ'ai fait \xe7a en quelques heures sur mon temps libre.\n\nComme j'utilise des photos publiques sans donn\xe9es personnelles, je dois \xeatre bon niveau RGPD,\nmais si vous souhaitez que j'\xf4te votre num\xe9ro de dossard, contactez-moi et je le ferai au plus t\xf4t.\n\nSi vous \xeates en possession d'un CDI ou contrat de freelance comme data scientist / analyst,\nn'h\xe9sitez pas non plus \xe0 me contacter \U0001f609.\n\nOh, et je n'ai pas trouv\xe9 de photos de mon dossard (53027) \U0001fae0\n\n"""\n\n\nentree = pn.widgets.IntInput(name='Entrez un num\xe9ro de dossard (1-53 500)', start=1, end=53500)\nrecherche=pn.widgets.Button(name="Recherche", button_type="primary")\n\n\n\ndef make_img_mkdwn(url):\n    base_url="https://marathondesecluses53.org/wp-content/uploads/2025/10/"\n    mini_url=f"{url[:-4]}-150x150.jpg"\n    text=f"""\\n\\n### {url}\n![{mini_url}]({base_url}{mini_url})\\n\n[T\xe9l\xe9charger en plein format]({base_url}{url})\n\n    """\n    return text\n\n\ndef make_mkdn(recherche):\n    key=str(entree.value)\n    mkdn=""\n\n    if recherche==False:\n        return pn.pane.Markdown(mkdn) \n    \n    if key in dossard2urls:\n        mkdn+="# Correspondance exacte"\n        for url in dossard2urls[key]:\n            mkdn+=make_img_mkdwn(url)\n\n    if len(key)<3:\n        return pn.pane.Markdown(mkdn) \n        \n    partial_keys=sorted(list(set(s for s in dossard2urls if s != key \\\n                          and (s in key or key in s)  and len (s)>=3)) )\n    if len(partial_keys)>0:\n        mkdn+="\\n\\n# Correspondance partielle"\n        for pkey in partial_keys:\n            mkdn+=f"\\n\\n## {pkey}"\n            for url in dossard2urls[pkey]:\n                mkdn+=make_img_mkdwn(url)\n    else:\n        if key not in dossard2urls:\n            mkdn='# Correspondance non trouv\xe9e, d\xe9sol\xe9...'\n\n    return pn.pane.Markdown(mkdn)\n\n\nbound_function=pn.bind(make_mkdn, recherche)\n\ntemplate = pn.template.MaterialTemplate(\n    title='Photos par dossard du Marathon des \xc9cluses 2025',\n    main=pn.Column(pn.Row(entree, recherche),\n                   bound_function,\n                   pn.pane.Alert(infos, alert_type="warning")),\n    header_background="red"\n)\n\ntemplate.servable()\n\n\n\nawait write_doc()`)
    self.postMessage({
      type: 'render',
      docs_json: docs_json,
      render_items: render_items,
      root_ids: root_ids
    })
  } catch(e) {
    const traceback = `${e}`
    const tblines = traceback.split('\n')
    self.postMessage({
      type: 'status',
      msg: tblines[tblines.length-2]
    });
    throw e
  }
}

self.onmessage = async (event) => {
  const msg = event.data
  if (msg.type === 'rendered') {
    self.pyodide.runPythonAsync(`
    from panel.io.state import state
    from panel.io.pyodide import _link_docs_worker

    _link_docs_worker(state.curdoc, sendPatch, setter='js')
    `)
  } else if (msg.type === 'patch') {
    self.pyodide.globals.set('patch', msg.patch)
    self.pyodide.runPythonAsync(`
    from panel.io.pyodide import _convert_json_patch
    state.curdoc.apply_json_patch(_convert_json_patch(patch), setter='js')
    `)
    self.postMessage({type: 'idle'})
  } else if (msg.type === 'location') {
    self.pyodide.globals.set('location', msg.location)
    self.pyodide.runPythonAsync(`
    import json
    from panel.io.state import state
    from panel.util import edit_readonly
    if state.location:
        loc_data = json.loads(location)
        with edit_readonly(state.location):
            state.location.param.update({
                k: v for k, v in loc_data.items() if k in state.location.param
            })
    `)
  }
}

startApplication()