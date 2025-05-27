document.addEventListener("DOMContentLoaded", function () {
	const variablesTableBody = document.querySelector("#variablesTable tbody");
	const fFunctionsTableBody = document.querySelector("#fFunctionsTable tbody");
	const zFunctionsTableBody = document.querySelector("#zFunctionsTable tbody");

	const calculateButton = document.getElementById("calculateButton");
	const saveJsonButton = document.getElementById("saveJsonButton");
	const loadJsonButton = document.getElementById("loadJsonButton");
	const fillRandomButton = document.getElementById("fillRandomButton");

	const resultsArea = document.getElementById("resultsArea");
	const statusMessageEl = document.getElementById("statusMessage");
	const mainPlotImg = document.getElementById("mainPlot");
	const coeffsInfoEl = document.getElementById("coeffsInfo");

	const DEFAULT_COEFF_VALUE = 0; // Для полиномов
	const DEFAULT_L_START_VALUE = 0.1;

	// --- Генерация таблиц ---
	function createInputField(
		type,
		id,
		value,
		step = "0.01",
		className = "table-input"
	) {
		const input = document.createElement("input");
		input.type = type;
		input.id = id;
		input.className = className;
		input.value = value;
		if (type === "number") input.step = step;
		return input;
	}

	// Генерация таблицы переменных L_i
	function populateVariablesTable() {
		if (!variablesTableBody) return;
		for (let i = 0; i < NUM_L_VARIABLES; i++) {
			const row = variablesTableBody.insertRow();
			const cellName = row.insertCell();
			cellName.textContent = L_VARIABLE_NAMES[i] || `L${i + 1}`;

			const cellStart = row.insertCell();
			cellStart.appendChild(
				createInputField("number", `l_start_${i}`, DEFAULT_L_START_VALUE)
			);

			// Заглушки для предельного и минимального, т.к. не используются в расчете
			const cellLimit = row.insertCell();
			cellLimit.appendChild(
				createInputField("number", `l_limit_${i}`, DEFAULT_L_START_VALUE + 0.2)
			);
			const cellMin = row.insertCell();
			cellMin.appendChild(createInputField("number", `l_min_${i}`, 0));
		}
	}

	// Генерация таблиц функций f_i и z_i
	function populateFunctionsTable(tableBody, prefix, numFunctions) {
		if (!tableBody) return;
		for (let i = 0; i < numFunctions; i++) {
			const row = tableBody.insertRow();
			const cellName = row.insertCell();
			cellName.innerHTML = `${prefix}<sub>${i + 1}</sub> =`;

			// Коэффициенты c3, c2, c1, c0
			for (let j = 3; j >= 0; j--) {
				// c3, c2, c1, c0
				const cellCoeff = row.insertCell();
				// ID: f_coeff_0_c3 (для f1, коэф. при x^3)
				// ID: z_coeff_0_c3 (для z1, коэф. при t^3)
				cellCoeff.appendChild(
					createInputField(
						"number",
						`${prefix}_coeff_${i}_c${j}`,
						DEFAULT_COEFF_VALUE
					)
				);
			}
		}
	}

	populateVariablesTable();
	populateFunctionsTable(fFunctionsTableBody, "f", NUM_F_FUNCTIONS);
	populateFunctionsTable(zFunctionsTableBody, "z", NUM_Z_FUNCTIONS);

	// --- Сбор данных ---
	function getTableData(numRows, prefix, numCoeffsPerPoly) {
		const dataArray = [];
		for (let i = 0; i < numRows; i++) {
			const polyCoeffs = [];
			for (let j = 0; j < numCoeffsPerPoly; j++) {
				// Собираем в порядке c0, c1, c2, c3
				const coeff_c_index = numCoeffsPerPoly - 1 - j; // для 4 коэф: c3,c2,c1,c0 -> j=0 (c3), j=1 (c2)..
				// нам нужен порядок c0, c1, c2, c3 для Polynomial класса
				const inputId = `${prefix}_coeff_${i}_c${j}`; // Собираем в порядке c3, c2, c1, c0
				const inputEl = document.getElementById(inputId);
				polyCoeffs.push(inputEl ? parseFloat(inputEl.value) || 0 : 0);
			}
			dataArray.push(polyCoeffs.reverse()); // Переворачиваем, чтобы было [c0, c1, c2, c3]
		}
		return dataArray;
	}

	// --- Обработчики кнопок ---
	if (calculateButton) {
		calculateButton.addEventListener("click", async function () {
			calculateButton.disabled = true;
			statusMessageEl.textContent =
				"Выполняется расчет... Пожалуйста, подождите.";
			statusMessageEl.className = "status";
			resultsArea.style.display = "block";
			mainPlotImg.style.display = "none";
			coeffsInfoEl.textContent = "";

			const start_conditions = [];
			for (let i = 0; i < NUM_L_VARIABLES; i++) {
				const inputEl = document.getElementById(`l_start_${i}`);
				start_conditions.push(
					inputEl ? parseFloat(inputEl.value) || 0 : DEFAULT_L_START_VALUE
				);
			}

			// Полиномы f_i и z_i всегда 3-й степени, значит 4 коэффициента
			const numCoeffsPerPoly = 4;
			const f_coeffs = getTableData(NUM_F_FUNCTIONS, "f", numCoeffsPerPoly);
			const z_coeffs = getTableData(NUM_Z_FUNCTIONS, "z", numCoeffsPerPoly);

			const payload = {
				start_conditions: start_conditions,
				// Внутренние полиномы (f_i), которые пользователь ввел.
				// Сервер будет их проверять и, если нужно, генерировать случайные.
				initial_f_coeffs: f_coeffs,
				// Внешние полиномы (z_i), которые я раньше называл q_coeffs
				z_coeffs: z_coeffs,

				// Параметры для проверки и генерации f_coeffs (если initial_f_coeffs не пройдут)
				poly_output_lower_bound: parseFloat(
					document.getElementById("poly_output_lower_bound").value
				),
				max_iterations_coeff_search: parseInt(
					document.getElementById("max_iterations_coeff_search").value
				),
				internal_coeff_min_random: parseFloat(
					document.getElementById("internal_coeff_min_random").value
				),
				internal_coeff_max_random: parseFloat(
					document.getElementById("internal_coeff_max_random").value
				),
				internal_poly_check_range_min: parseFloat(
					document.getElementById("internal_poly_check_range_min").value
				),
				internal_poly_check_range_max: parseFloat(
					document.getElementById("internal_poly_check_range_max").value
				),
				internal_poly_check_granularity: parseInt(
					document.getElementById("internal_poly_check_granularity").value
				),
			};
			// console.log("Payload to server:", JSON.stringify(payload, null, 2)); // Для отладки

			try {
				const response = await fetch("/calculate", {
					method: "POST",
					headers: { "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				const result = await response.json();

				if (response.ok) {
					statusMessageEl.textContent = result.message || "Расчет завершен!";
					statusMessageEl.className = "status success";
					if (result.main_plot_url) {
						mainPlotImg.src =
							result.main_plot_url + "?t=" + new Date().getTime();
						mainPlotImg.style.display = "block";
					}
					if (result.final_f_coeffs_snippet) {
						// Изменено имя поля
						coeffsInfoEl.innerHTML = `<b>Пример финальных коэффициентов для первых 5 внутренних полиномов (f_i):</b><br> ${JSON.stringify(
							result.final_f_coeffs_snippet
						)}`;
					}
				} else {
					statusMessageEl.textContent =
						"Ошибка сервера: " +
						(result.error || response.statusText || "Неизвестная ошибка");
					statusMessageEl.className = "status error";
				}
			} catch (error) {
				statusMessageEl.textContent =
					"Сетевая ошибка или ошибка клиента: " + error.message;
				statusMessageEl.className = "status error";
				console.error("Fetch error:", error);
			} finally {
				calculateButton.disabled = false;
			}
		});
	}

	if (fillRandomButton) {
		fillRandomButton.addEventListener("click", function () {
			// 1. Заполнение начальных условий L_i (оставляем как есть или корректируем диапазон)
			for (let i = 0; i < NUM_L_VARIABLES; i++) {
				const inputEl = document.getElementById(`l_start_${i}`);
				if (inputEl) {
					inputEl.value = (Math.random() * 0.9 + 0.05).toFixed(2);
				}
				// ... (остальные поля L_i) ...
			}

			// 2. Заполнение коэффициентов полиномов f_i
			// ВАЖНО: Для теста с одним полиномом и положительными коэффициентами:
			const f_coeffMin_frontend_test = 0.1; // Как мы задали для серверной генерации в тесте
			const f_coeffMax_frontend_test = 0.5; // Как мы задали для серверной генерации в тесте

			// Если NUM_F_FUNCTIONS === 1 (наш текущий тест), используем эти диапазоны.
			// Иначе, можно использовать более общие, как было раньше.
			const current_f_coeffMin =
				NUM_F_FUNCTIONS === 1 ? f_coeffMin_frontend_test : -0.5; // Старый общий диапазон -0.5
			const current_f_coeffMax =
				NUM_F_FUNCTIONS === 1 ? f_coeffMax_frontend_test : 0.5; // Старый общий диапазон 0.5

			for (let i = 0; i < NUM_F_FUNCTIONS; i++) {
				for (let j = 3; j >= 0; j--) {
					// c3, c2, c1, c0
					const inputEl = document.getElementById(`f_coeff_${i}_c${j}`);
					if (inputEl) {
						inputEl.value = (
							Math.random() * (current_f_coeffMax - current_f_coeffMin) +
							current_f_coeffMin
						).toFixed(2);
					}
				}
			}

			// 3. Заполнение коэффициентов полиномов z_i (можно оставить старый диапазон или тоже сделать положительным для теста)
			const z_coeffMin = -0.5;
			const z_coeffMax = 0.5;
			for (let i = 0; i < NUM_Z_FUNCTIONS; i++) {
				for (let j = 3; j >= 0; j--) {
					// c3, c2, c1, c0
					const inputEl = document.getElementById(`z_coeff_${i}_c${j}`);
					if (inputEl) {
						inputEl.value = (
							Math.random() * (z_coeffMax - z_coeffMin) +
							z_coeffMin
						).toFixed(2);
					}
				}
			}

			statusMessageEl.textContent = "Поля заполнены случайными значениями.";
			statusMessageEl.className = "status success";
			resultsArea.style.display = "block";
			mainPlotImg.style.display = "none";
			coeffsInfoEl.textContent = "";
		});
	}

	// Заглушки для остальных кнопок
	[saveJsonButton, loadJsonButton].forEach(button => {
		if (button && !button.getAttribute("listener")) {
			// Проверяем, не добавлен ли уже слушатель
			button.addEventListener("click", function () {
				alert(`Кнопка "${this.textContent}" еще не реализована.`);
			});
			button.setAttribute("listener", "true");
		}
	});
});
