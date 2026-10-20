export async function extraerVehiculo(page) {
  return page.evaluate(() => {
    const labels = ["N\u00famero de chasis", "Modelo", "Fecha de producci\u00f3n", "A\u00f1o de fabricaci\u00f3n", "C\u00f3digo del motor", "Cilindrada"];
    const fields = {};
    const divs = Array.from(document.querySelectorAll("div"));
    for (const label of labels) {
      const node = divs.find((element) => element.children.length === 0 && element.textContent?.trim() === label);
      const value = node?.nextElementSibling;
      fields[label] = value?.textContent?.trim().replace(/\s+/g, " ") || "";
    }
    const title = document.title.includes(",") ? document.title.split(",")[0]?.trim() || "" : "";
    return {
      chasis: fields["N\u00famero de chasis"] || "",
      marca: title,
      modelo: fields.Modelo || "",
      motor: fields["C\u00f3digo del motor"] || "",
      anio: fields["A\u00f1o de fabricaci\u00f3n"] || "",
      cilindrada: fields.Cilindrada || "",
      fechaProduccion: fields["Fecha de producci\u00f3n"] || "",
    };
  });
}
