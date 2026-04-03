const { classes, config } = window.CHCATECH;

const form = document.getElementById("inspectionForm");
const classSelect = document.getElementById("vehicleClass");
const checklistContainer = document.getElementById("dynamicChecklist");
const checklistHint = document.getElementById("checklistHint");
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
const CAR_PERSONAL_SAFETY_RULES = [
  {
    label: "Helmet meets rule: Snell SA2015+ or FIA 8859-2015+, under 10 years old",
    matchers: [/helmet/],
  },
  {
    label: "Full-face helmet present if no full windshield",
    matchers: [/full-face helmet/, /full windshield/],
  },
  {
    label: "Head and neck restraint present: SFI 38.1, within 5-year recert window",
    matchers: [/head and neck restraint/, /frontal head restraint/, /hans/, /hybrid/],
  },
  {
    label: "Harness is 5-point minimum and current",
    matchers: [/harness/],
  },
  {
    label: "Suit present: SFI 3-2A or FIA 8856-2000 minimum",
    matchers: [/suit/, /fire suit/],
  },
  {
    label: "Gloves present",
    matchers: [/gloves/],
  },
  {
    label: "Shoes / boots present",
    matchers: [/shoes/, /boots/],
  },
];
const RIDER_PERSONAL_SAFETY_RULES_BY_CLASS = {
  quad: [
    {
      label: "Rider is wearing approved motocross gear or leathers in good condition",
      matchers: [/motocross gear/, /leathers/, /rider gear/],
    },
    {
      label: "Helmet is worn whenever machine is in motion",
      matchers: [/helmet is worn/],
    },
    {
      label: "Helmet certification meets approved standard",
      matchers: [/helmet certification/, /helmet.*approved standard/],
    },
    {
      label: "Required protective gear is present: boots, gloves, eye / face protection, neck protection, and chest protector or approved leather setup",
      matchers: [/protective gear/, /eye \/ face protection/, /chest protector/],
    },
  ],
  motorcycle: [
    {
      label: "Helmet is worn whenever the motorcycle is in motion",
      matchers: [/helmet is worn/],
    },
    {
      label: "Helmet certification meets approved standard",
      matchers: [/helmet certification/, /helmet.*approved standard/],
    },
    {
      label: "Required protective apparel is present: boots, gloves, race pants or leathers, eye / face protection, neck protection, and chest protector or approved leather setup",
      matchers: [/protective apparel/, /eye \/ face protection/, /chest protector/, /leathers/],
    },
  ],
};

let currentStep = 1;

populateClassOptions();
setDefaultDate();
syncOwnerFields();
renderChecklist(classSelect.value);
renderWizardStep();

classSelect.addEventListener("change", () => {
  renderChecklist(classSelect.value);
  renderWizardStep();
});

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
    checklistHint.textContent = "Choose a class above to load the required personal safety and car inspection items.";
    return;
  }

  const checklistSections = getChecklistSections(selectedClass);
  renderClassSpecificFields(selectedClass);
  checklistContainer.className = "dynamic-checklist";
  checklistHint.textContent = `${selectedClass.summary} ${checklistSections.length} section(s) loaded.`;
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
    classDetailsHint.textContent = "Class-specific fields appear here only when the selected class requires them.";
    return;
  }

  classDetailsHint.textContent = `${selectedClass.label} requires ${selectedClass.extraFields.length} class-specific field(s) before the checklist.`;

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
          <label><input type="radio" name="${key}__status" value="Pass" required /><span>Pass</span></label>
          <label><input type="radio" name="${key}__status" value="Fail" required /><span>Fail</span></label>
          <label><input type="radio" name="${key}__status" value="N/A" required /><span>N/A</span></label>
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

  const requiredPersonalSafetyRules =
    RIDER_PERSONAL_SAFETY_RULES_BY_CLASS[selectedClass.id] || CAR_PERSONAL_SAFETY_RULES;
  const ensuredPersonalSafetyItems = ensureRequiredPersonalSafetyItems(
    personalSafetyItems,
    requiredPersonalSafetyRules,
  );

  return [
    { title: "Personal Safety", items: ensuredPersonalSafetyItems },
    { title: "Car", items: carItems },
  ];
}

function ensureRequiredPersonalSafetyItems(items, rules) {
  const mergedItems = [...items];

  rules.forEach((rule) => {
    const alreadyPresent = mergedItems.some((item) =>
      rule.matchers.some((matcher) => matcher.test(item.toLowerCase())),
    );

    if (!alreadyPresent) {
      mergedItems.push(rule.label);
    }
  });

  return mergedItems;
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
      source: "chca-tech-inspection-app",
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
    statusCard.innerHTML = `
      <strong>Submission Error</strong>
      <p>
        No submission endpoint is configured. Add the Apps Script web app URL in
        <code>tech-data.js</code> before using this form live.
      </p>
    `;
    return;
  }

  statusCard.innerHTML = "<strong>Submitting...</strong><p>Sending inspection data to Google.</p>";

  try {
    await fetch(config.appsScriptUrl, {
      method: "POST",
      mode: "no-cors",
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
      body: JSON.stringify(payload),
    });
    statusCard.innerHTML = `
      <strong>Submission Complete</strong>
      <p>Inspection submitted to Google Sheets, PDF generation, and email delivery.</p>
    `;
  } catch (error) {
    statusCard.innerHTML = `
      <strong>Submission Error</strong>
      <p>${error.message}. The inspection was not sent to Google.</p>
    `;
  }
}
