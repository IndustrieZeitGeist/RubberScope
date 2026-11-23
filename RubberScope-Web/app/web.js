const form = document.querySelector("#analysis");
const status = document.querySelector("#status");
const panel = document.querySelector("#result");
const overlay = document.querySelector("#overlay");
const download = document.querySelector("#download");
const metrics = document.querySelector("#metrics");
const labels = {
    object_count: "Risskandidaten",
    feature_area_fraction_pct: "Flächenanteil (%)",
    crack_total_length_px: "Skelettlänge (px)",
    crack_mean_width_px: "Mittlere Breite (px)",
    scale_um_per_px: "Maßstab (µm/px)",
    scale_source: "Quelle des Maßstabs",
    crack_length_density_mm_per_mm2: "Längendichte (mm/mm²)",
    crack_mean_width_um: "Mittlere Breite (µm)",
};
const algorithm = form.elements.algorithm;
const profiles = form.querySelectorAll("[data-profile]");
const useRoi = document.querySelector("#use-roi");
const roiFields = document.querySelector("#roi");
const resultFile = document.querySelector("#result-file");
const robustness = document.querySelector("#robustness");
const numberFields = ["scale_um", "sensitivity", "min_area", "scale_uncertainty_pct", "strain_direction_deg"];
const boolFields = ["prefer_metadata", "exclude_edge_objects", "bright_features", "surface_features",
    "robustness", "controlled_acquisition", "edge_cracks"];
const roiKeys = ["x0", "y0", "x1", "y1"];

Object.assign(labels, {
    raw_object_count: "Objekte vor Randausschluss",
    edge_object_count: "Verbliebene Randobjekte",
    effective_evaluated_area_px2: "Bezugsfläche (px²)",
    effective_evaluated_area_mm2: "Bezugsfläche (mm²)",
    feature_density_mm2: "Objektdichte (1/mm²)",
    crack_total_length_mm: "Skelettlänge (mm)",
    crack_perpendicular_length_fraction_pct: "Längenanteil quer (%)",
    crack_perp_count: "Objekte quer zur Dehnung",
    uncertainty_length_density_rel_pct: "Kalibrierbeitrag zur Längendichte (%)",
    uncertainty_area_rel_pct: "Kalibrierbeitrag zur Fläche (%)",
    bright_feature_count: "Helle Auffälligkeiten",
    bright_feature_area_fraction_pct: "Helle Fläche (%)",
    highlight_object_count: "Reflexionskandidaten",
    highlight_area_fraction_pct: "Reflexionsfläche (%)",
    image_median_gray: "Median der Graustufen",
    image_p95_gray: "95. Perzentil der Graustufen",
    image_p99_gray: "99. Perzentil der Graustufen",
    surface_texture_rms_gray: "Textur-RMS (Graustufen)",
});

const profileOptions = document.querySelectorAll("#profile-options input, #profile-options select");
const savedOptions = new Map();
let activeProfile = algorithm.value;

function updateRoi() {
    roiFields.disabled = roiFields.hidden = !useRoi.checked;
}

function readOption(input) {
    return input.type === "checkbox" ? input.checked : input.value;
}

const defaultOptions = Array.from(profileOptions, readOption);

algorithm.addEventListener("change", () => {
    savedOptions.set(activeProfile, Array.from(profileOptions, readOption));
    activeProfile = algorithm.value;
    const nextOptions = savedOptions.get(activeProfile) ?? defaultOptions;
    profileOptions.forEach((input, index) => {
        if (input.type === "checkbox") input.checked = nextOptions[index];
        else input.value = nextOptions[index];
    });
    for (const profile of profiles) {
        profile.disabled = profile.hidden = profile.dataset.profile !== activeProfile;
    }
    updateRoi();
});
useRoi.addEventListener("change", updateRoi);

form.addEventListener("invalid", (event) => {
    let details = event.target.closest("details");
    while (details) {
        details.open = true;
        details = details.parentElement.closest("details");
    }
}, true);
function getSettings(data) {
    const settings = Object.fromEntries(data);
    delete settings.image;
    for (const key of numberFields) {
        if (settings[key] === "") delete settings[key];
        else settings[key] = Number(settings[key]);
    }
    for (const key of boolFields) settings[key] = data.has(key);
    if (useRoi.checked) {
        settings.roi = roiKeys.map((key) => Number(data.get(key)));
        for (const key of roiKeys) delete settings[key];
    }
    return settings;
}

function showRobustness(rows) {
    robustness.replaceChildren();
    if (!rows) return;
    const details = document.createElement("details");
    const heading = document.createElement("summary");
    heading.textContent = "Robustheitsprüfung";
    const wrapper = document.createElement("div");
    wrapper.className = "scroll-table";
    const table = document.createElement("table");
    const headers = ["Faktor", "k", "Fläche (%)", "Δ Fläche (%)", "Längendichte (mm/mm²)", "Δ Längendichte (%)"];
    const fields = ["factor", "sensitivity", "area_fraction_pct", "area_rel_change_pct", "length_density_mm_per_mm2", "length_rel_change_pct"];
    const header = table.createTHead().insertRow();
    for (const label of headers) {
        const th = document.createElement("th");
        th.scope = "col";
        th.textContent = label;
        header.append(th);
    }
    const body = table.createTBody();
    for (const values of rows) {
        const row = body.insertRow();
        for (const key of fields) row.insertCell().textContent = formatValue(values[key]);
    }
    wrapper.append(table);
    details.append(heading, wrapper);
    robustness.append(details);
}

function formatValue(value) {
    return typeof value === "number" ? format.format(value) : value ?? "—";
}

const format = new Intl.NumberFormat("de-DE", {maximumFractionDigits: 6});

form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const image = data.get("image");
    if (image.size > 16 * 1024 * 1024) {
        panel.hidden = true;
        status.textContent = "Das Bild ist größer als 16 MiB.";
        return;
    }
    const settings = getSettings(data);
    const encodedSettings = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(settings))));
    const button = form.querySelector("button");
    button.disabled = true;
    panel.hidden = true;
    status.textContent = "Bild wird ausgewertet …";
    try {
        const response = await fetch("/api/analyze", {
            method: "POST",
            headers: {"Content-Type": "application/octet-stream", "X-RubberScope-Settings": encodedSettings},
            body: image,
        });
        const result = await response.json();
        if (!response.ok) {
            throw new Error(typeof result.detail === "string" ? result.detail : "Bitte Eingaben prüfen.");
        }
        overlay.src = "data:image/png;base64," + result.overlay;
        download.href = overlay.src;
        metrics.replaceChildren();
        for (const [key, label] of Object.entries(labels)) {
            const term = document.createElement("dt");
            const description = document.createElement("dd");
            const value = result.metrics[key];
            term.textContent = label;
            description.textContent = formatValue(value);
            metrics.append(term, description);
        }
        showRobustness(result.robustness);
        if (resultFile.href) URL.revokeObjectURL(resultFile.href);
        delete result.overlay;
        resultFile.href = URL.createObjectURL(new Blob([JSON.stringify(result, null, 2)], {type: "application/json"}));
        panel.hidden = false;
        status.textContent = "Auswertung abgeschlossen.";
    } catch (error) {
        status.textContent = error.message;
    } finally {
        button.disabled = false;
    }
});




