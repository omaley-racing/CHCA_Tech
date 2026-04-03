const { classes, config } = window.CHCATECH;

const form = document.getElementById("inspectionForm");
const classSelect = document.getElementById("vehicleClass");
const checklistContainer = document.getElementById("dynamicChecklist");
const checklistHint = document.getElementById("checklistHint");
const payloadPreview = document.getElementById("payloadPreview");
const previewPayloadButton = document.getElementById("previewPayloadButton");
const statusCard = document.getElementById("statusCard");
const sameAsDriverCheckbox = document.getElementById("sameAsDriver");
const classDetailsPanel = document.getElementById("classDetailsPanel");
const classDetailsHint = document.getElementById("classDetailsHint");
const classSpecificFields = document.getElementById("classSpecificFields");
const wizardPanels = Array.from(document.querySelectorAll("[data-step]"));
const nextButtons = Array.from(document.querySelectorAll("[data-step-next]"));
const backButtons = Array.from(document.querySelectorAll("[data-step-back]"));
const finalStep = 4;
const ownerFieldNames = ["ownerName", "ownerEmail", "ownerPhone"];
const ownerFieldMap = {
  ownerName: "driverName",
  ownerEmail: "driverEmail",
  ownerPhone: "driverPhone",
};

let currentStep = 1;

populateClassOptions();
setDefaultDate();
syncOwnerFields();
renderChecklist(classSelect.value);
renderWizardStep();
renderPayloadPreview();

classSelect.addEventListener("change", () => {
  renderChecklist(classSelect.value);
  renderWizardStep();
  renderPayloadPreview();
});

form.addEventListener("input", renderPayloadPreview);
form.addEventListener("change", renderPayloadPreview);
previewPayloadButton.addEventListener("click", renderPayloadPreview);
form.addEventListener("submit", handleSubmit);
sameAsDriverCheckbox.addEventListener("change", handleSameAsDriverChange);
nextButtons.forEach((button) => {
  button.addEventListener("click", () => goToNextStep(Number(button.dataset.stepNext)));
});
backButtons.forEach((button) => {
  button.addEventListener("click", () => goToPreviousStep(Number(button.dataset.stepBack)));
});

["driverName", "driverEmail", "driverPhone"].forEach((fieldName) => {
  form.elements[fieldName].addEventListener("input", () => {
    if (sameAsDriverCheckbox.checked) {
      syncOwnerFields();
      renderPayloadPreview();
    }
  });
});

function goToNextStep(step) {
  if (!validateStep(step)) {
    return;
  }

  currentStep = Math.min(finalStep, step + 1);
  renderWizardStep({ scroll: true });
}

function goToPreviousStep(step) {
  currentStep = Math.max(1, step - 1);
  renderWizardStep({ scroll: true });
}

function handleSameAsDriverChange() {
  syncOwnerFields();
  renderPayloadPreview();
}

function syncOwnerFields() {
  const ownerIsDriver = sameAsDriverCheckbox.checked;

  ownerFieldNames.forEach((ownerFieldName) => {
    const ownerField = form.elements[ownerFieldName];
    const driverField = form.elements[ownerFieldMap[ownerFieldName]];

    if (ownerIsDriver) {
      ownerField.value = driverField.value;
    }

    ownerField.readOnly = ownerIsDriver;
  });
}

function populateClassOptions() {
  classes.forEach((vehicleClass) => {
    const option = document.createElement("option");
    option.value = vehicleClass.id;
    option.textContent = vehicleClass.label;
    classSelect.appendChild(option);
  });
}

function setDefaultDate() {
  const dateInput = form.elements.inspectionDate;
  if (!dateInput.value) {
    dateInput.valueAsDate = new Date();
  }
}

function renderChecklist(classId) {
  const selectedClass = classes.find((vehicleClass) => vehicleClass.id === classId);

  if (!selectedClass) {
    renderClassSpecificFields(null);
    checklistContainer.className = "dynamic-checklist empty-state";
    checklistContainer.innerHTML = "<p>No class selected yet.</p>";
    checklistHint.textContent = "Choose a class above to load the required inspection items.";
    return;
  }

  const checklistSections = getChecklistSections(selectedClass);
  renderClassSpecificFields(selectedClass);
  checklistContainer.className = "dynamic-checklist";
  checklistHint.textContent = `${selectedClass.summary} ${checklistSections.length} personal safety / car section(s) loaded.`;
  checklistContainer.innerHTML = "";

  checklistSections.forEach((section, sectionIndex) => {
    const sectionEl = document.createElement("section");
    sectionEl.className = "check-section";
    sectionEl.innerHTML = `
      <div class="check-section-header">
        <h3>${section.title}</h3>
        <p>${section.items.length} item(s)</p>
      </div>
      <div class="check-items"></div>
    `;

    const itemsWrap = sectionEl.querySelector(".check-items");
    if (section.items.length === 0) {
      itemsWrap.innerHTML = `<p class="empty-checklist">No ${section.title.toLowerCase()} items defined for ${selectedClass.label}.</p>`;
    } else {
      section.items.forEach((itemLabel, itemIndex) => {
        itemsWrap.appendChild(createChecklistItem(sectionIndex, itemIndex, itemLabel));
      });
    }

    checklistContainer.appendChild(sectionEl);
  });
}

function renderClassSpecificFields(selectedClass) {
  classSpecificFields.innerHTML = "";

  if (!selectedClass || !selectedClass.extraFields || selectedClass.extraFields.length === 0) {
    classDetailsHint.textContent = "Additional fields will appear here for the selected class.";
    return;
  }

  classDetailsHint.textContent = `${selectedClass.label} requires ${selectedClass.extraFields.length} additional field(s).`;

  selectedClass.extraFields.forEach((field) => {
    const label = document.createElement("label");
    const title = document.createElement("span");
    title.textContent = field.label;
    label.appendChild(title);

    let input;

    if (field.type === "select") {
      input = document.createElement("select");
      input.name = field.name;
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "Select one";
      input.appendChild(emptyOption);
      field.options.forEach((optionValue) => {
        const option = document.createElement("option");
        option.value = optionValue;
        option.textContent = optionValue;
        input.appendChild(option);
      });
    } else {
      input = document.createElement("input");
      input.type = field.type || "text";
      input.name = field.name;
      if (field.placeholder) {
        input.placeholder = field.placeholder;
      }
    }

    if (field.required) {
      input.required = true;
    }

    label.appendChild(input);
    classSpecificFields.appendChild(label);
  });
}

function createChecklistItem(sectionIndex, itemIndex, itemLabel) {
  const itemCard = document.createElement("article");
  itemCard.className = "item-card";
  const key = `s${sectionIndex}i${itemIndex}`;

  itemCard.innerHTML = `
    <div class="item-title">${itemLabel}</div>
    <div class="item-grid">
      <fieldset>
        <legend class="mini-label">Result</legend>
        <div class="pill-group">
          <label><input type="radio" name="${key}__status" value="Pass" /><span>Pass</span></label>
          <label><input type="radio" name="${key}__status" value="Fail" /><span>Fail</span></label>
          <label><input type="radio" name="${key}__status" value="N/A" /><span>N/A</span></label>
        </div>
      </fieldset>
      <label>
        <span class="mini-label">Notes</span>
        <input type="text" name="${key}__notes" placeholder="Optional notes" />
      </label>
    </div>
    <label class="follow-up-toggle" hidden>
      <input type="checkbox" name="${key}__requiredFollowUp" />
      <span>Required Follow-Up</span>
    </label>
  `;

  const followUpToggle = itemCard.querySelector(".follow-up-toggle");
  const followUpCheckbox = itemCard.querySelector(`input[name="${key}__requiredFollowUp"]`);
  const statusInputs = itemCard.querySelectorAll(`input[name="${key}__status"]`);

  statusInputs.forEach((input) => {
    input.addEventListener("change", () => {
      const showFollowUp = input.value === "Fail" && input.checked;
      followUpToggle.hidden = !showFollowUp;

      if (!showFollowUp) {
        followUpCheckbox.checked = false;
      }
    });
  });

  return itemCard;
}

function getChecklistSections(selectedClass) {
  const personalSafetyItems = [];
  const carItems = [];
  if (!selectedClass) {
    return [
      { title: "Personal Safety", items: personalSafetyItems },
      { title: "Car", items: carItems },
    ];
  }

  selectedClass.sections.forEach((section) => {
    section.items.forEach((itemLabel) => {
      if (isPersonalSafetyItem(itemLabel)) {
        personalSafetyItems.push(itemLabel);
      } else {
        carItems.push(itemLabel);
      }
    });
  });

  return [
    { title: "Personal Safety", items: personalSafetyItems },
    { title: "Car", items: carItems },
  ];
}

function isPersonalSafetyItem(itemLabel) {
  const normalizedLabel = itemLabel.toLowerCase();
  const carSafetyKeywords = [
    "window net",
    "windows net",
    "safety net",
    "seat secure",
    "seat and belt",
    "seat installation",
    "seat belt cutter",
    "padded headrest",
    "headrest support",
    "padding installed",
    "cage padding",
    "helmet clearance",
    "fire suppression",
    "fire extinguisher",
    "harnesses compliant",
    "properly mounted",
    "mounted per rule",
    "installed and mounted",
  ];

  const personalSafetyKeywords = [
    "helmet",
    "full-face helmet",
    "head and neck restraint",
    "harness",
    "suit",
    "gloves",
    "shoes",
    "boots",
    "fire-resistant underwear",
    "protective gear",
    "protective apparel",
    "rider gear",
    "leathers",
    "eye / face protection",
    "neck protection",
    "chest protector",
    "arm restraint",
  ];

  if (carSafetyKeywords.some((keyword) => normalizedLabel.includes(keyword))) {
    return false;
  }

  return personalSafetyKeywords.some((keyword) => normalizedLabel.includes(keyword));
}

function hasClassSpecificFields() {
  const selectedClass = classes.find((vehicleClass) => vehicleClass.id === classSelect.value);
  return Boolean(selectedClass?.extraFields?.length);
}

function getPanelsForStep(step) {
  return wizardPanels.filter((panel) => Number(panel.dataset.step) === step);
}

function getVisiblePanelsForStep(step) {
  return getPanelsForStep(step).filter((panel) => !panel.hidden);
}

function renderWizardStep({ scroll = false } = {}) {
  wizardPanels.forEach((panel) => {
    const panelStep = Number(panel.dataset.step);
    const isCurrentStep = panelStep === currentStep;
    const shouldShowClassDetails = currentStep === 3 && hasClassSpecificFields();

    if (panel === classDetailsPanel) {
      panel.hidden = !(isCurrentStep && shouldShowClassDetails);
      return;
    }

    panel.hidden = !isCurrentStep;
  });

  if (scroll) {
    const firstVisiblePanel = getVisiblePanelsForStep(currentStep)[0];
    firstVisiblePanel?.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

function validateStep(step) {
  const visiblePanels = getVisiblePanelsForStep(step);

  for (const panel of visiblePanels) {
    const fields = panel.querySelectorAll("input, select, textarea");

    for (const field of fields) {
      if (!field.reportValidity()) {
        return false;
      }
    }
  }

  return true;
}

function serializeFormBasics() {
  const data = new FormData(form);
  const basic = Object.fromEntries(data.entries());
  const selectedClass = classes.find((vehicleClass) => vehicleClass.id === basic.vehicleClass);
  const extraDetails = {};

  (selectedClass?.extraFields || []).forEach((field) => {
    extraDetails[field.name] = basic[field.name] || "";
  });

  return {
    inspectionType: basic.inspectionType || "",
    inspectionDate: basic.inspectionDate || "",
    eventName: basic.eventName || "",
    inspectorName: basic.inspectorName || "",
    vehicleClass: basic.vehicleClass || "",
    carNumber: basic.carNumber || "",
    driver: {
      name: basic.driverName || "",
      email: basic.driverEmail || "",
      phone: basic.driverPhone || "",
    },
    owner: {
      name: basic.ownerName || "",
      email: basic.ownerEmail || "",
      phone: basic.ownerPhone || "",
    },
    vehicle: {
      description: basic.vehicleDescription || "",
    },
    classSpecificDetails: extraDetails,
    result: {
      overallResult: basic.overallResult || "",
      requiredCorrections: basic.requiredCorrections || "",
      helmetStickerNumber: basic.helmetStickerNumber || "",
      hansStickerNumber: basic.hansStickerNumber || "",
      carStickerNumber: basic.carStickerNumber || "",
      inspectorSignature: basic.inspectorSignature || "",
      driverOwnerSignature: basic.driverOwnerSignature || "",
      technicalDirectorApproval: basic.technicalDirectorApproval || "",
    },
    recipients: {
      techDirectorEmail: basic.techDirectorEmail || "",
      clubEmail: config.clubEmail,
      driverEmail: basic.driverEmail || "",
      ownerEmail: basic.ownerEmail || "",
    },
  };
}

function buildPayload() {
  const basic = serializeFormBasics();
  const selectedClass = classes.find((vehicleClass) => vehicleClass.id === basic.vehicleClass);

  return {
    metadata: {
      generatedAt: new Date().toISOString(),
      source: "github-pages-prototype",
      schemaVersion: 1,
    },
    inspection: {
      ...basic,
      classLabel: selectedClass?.label || "",
      classTitle: selectedClass?.title || "",
      checklist: selectedClass
        ? getChecklistSections(selectedClass).map((section, sectionIndex) => ({
            sectionTitle: section.title,
            items: section.items.map((itemLabel, itemIndex) => {
              const prefix = `s${sectionIndex}i${itemIndex}`;
              return {
                label: itemLabel,
                status: form.elements[`${prefix}__status`]?.value || "",
                notes: form.elements[`${prefix}__notes`]?.value || "",
                requiredFollowUp: form.elements[`${prefix}__requiredFollowUp`]?.checked || false,
              };
            }),
          }))
        : [],
    },
  };
}

function renderPayloadPreview() {
  payloadPreview.textContent = JSON.stringify(buildPayload(), null, 2);
}

async function handleSubmit(event) {
  event.preventDefault();

  if (!validateStep(finalStep)) {
    return;
  }

  const payload = buildPayload();

  if (!payload.inspection.vehicleClass) {
    checklistHint.textContent = "Choose a class before submitting.";
    classSelect.focus();
    return;
  }

  if (!config.appsScriptUrl) {
    payloadPreview.textContent = JSON.stringify(payload, null, 2);
    statusCard.innerHTML = `
      <strong>Prototype Status</strong>
      <p>
        No backend URL is configured yet, so the payload has been assembled locally for review.
        Add an Apps Script URL in <code>tech-data.js</code> to enable live submission.
      </p>
    `;
    return;
  }

  statusCard.innerHTML = "<strong>Submitting...</strong><p>Sending inspection data to the backend.</p>";

  try {
    const response = await fetch(config.appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Submission failed with status ${response.status}`);
    }

    const result = await response.json().catch(() => ({}));
    statusCard.innerHTML = `
      <strong>Submission Complete</strong>
      <p>Inspection saved successfully.${result.message ? ` ${result.message}` : ""}</p>
    `;
  } catch (error) {
    statusCard.innerHTML = `
      <strong>Submission Error</strong>
      <p>${error.message}. The payload is still shown below so nothing is lost.</p>
    `;
    payloadPreview.textContent = JSON.stringify(payload, null, 2);
  }
}
