var seller_cache = {};
var observer;
var trademarkLookupAllowed = false;

function injectCSS()
{
	var css = document.createElement("style");
	css.setAttribute("type", "text/css");
	css.textContent = `
.wtf-spinner {
   width: 12px;
   height: 12px;
   display: inline-block;
   border-radius: 50%;
   background: radial-gradient(farthest-side,#474bff 94%,#0000) top/3.8px 3.8px no-repeat,
          conic-gradient(#0000 30%,#474bff);
   -webkit-mask: radial-gradient(farthest-side,#0000 calc(100% - 3.8px),#000 0);
   animation: wtf-spinner-anim 1s infinite linear;
}

@keyframes wtf-spinner-anim {
   100% {
      transform: rotate(1turn);
   }
}
`;
	document.documentElement.appendChild(css);
}

function getAddress(dom)
{
	let info_block = dom.querySelector("#page-section-detail-seller-info");
	let headings = info_block.getElementsByClassName("a-text-bold");
	let business_name = headings[0].parentNode.querySelectorAll("span")[1].textContent;
	let business_addr = "";
	let business_country = "";
	
	// The business address is split into separate <span> elements for each line
	let addr_elems = info_block.querySelectorAll("div.indent-left > span");
	addr_elems.forEach(function(element, idx, array) {
		business_addr += element.textContent;
		if (idx != array.length - 1)
		{
			business_addr += "<br>";
		}
		
		if (element.textContent.toLowerCase().includes("cn") ||
			element.textContent.toLowerCase().includes("china"))
			{
				business_country = "China";
			}
	});
	
	// If no country was found, take the last line
	if (business_country.length == 0)
	{
		business_country = addr_elems[addr_elems.length - 1].textContent;
	}
	
	return [business_name, business_addr, business_country];
}

function remove_box()
{
	let self_exists = document.querySelector("#wheres-that-from");
	if (self_exists != null)
	{
		self_exists.remove();
	}
}

/**
 Just a simple hueristic to see if it's a Chinese company
 If it's 5-9 characters and all uppercase, it's Chinese
 */
function chinese_brand_heuristics(brand)
{
	if (brand.length >= 5 && brand.length <= 9)
	{
		for (const letter of brand)
		{
			if (!(letter.charCodeAt(0) >= 65 && letter.charCodeAt(0) <= 90))
			{
				// Contains a non-uppercase
				return false;
			}
		}
		return true;
	}
	
	return false;
}

function is_chinese(brand, trademark_data, seller_country)
{
	let source = "";
	let reason = "";
	let country = "";
	let foreign = false;
	let chinese = false;

	// Check the trademark data if available
	if (trademark_data != null)
	{
		// Trademark
		if ("mark_info" in trademark_data)
		{
			reason = "trademark";
			source = trademark_data["mark_info"]["source"]
			if (source == "https://uspto.gov/")
			{
				source = "https://tsdr.uspto.gov/#caseNumber=" + trademark_data["mark_info"]["serial"] + "&caseSearchType=US_APPLICATION&caseType=DEFAULT&searchType=statusSearch"
			}
			
			country = trademark_data["mark_info"]["country"];
			if (trademark_data["mark_info"]["is_foreign"] == "1")
			{
				foreign = true;
				if (country == "CN")
				{
					chinese = true;
				}
			}
		}
		// Company
		else if ("company_info" in trademark_data)
		{
			reason = "company";
			source = trademark_data["company_info"]["source"]
			country = trademark_data["company_info"]["country"];
			if (trademark_data["company_info"]["is_foreign"] == "1")
			{
				foreign = true;
				if (country == "CN")
				{
					chinese = true;
				}
			}
		}
	}

	// See if the brand name looks chinese, but only if we don't already have trademark data
	if (!chinese && source == "" && chinese_brand_heuristics(brand))
	{
		reason = "heuristics";
		chinese = true;
		foreign = true;
		country = "CN";
	}

	// See if the seller is from China
	if (!chinese && seller_country.toLowerCase().includes("china"))
	{
		reason = "seller";
		chinese = true;
		foreign = true;
		country = "CN";
	}

	return {
		is_chinese: chinese,
		is_foreign: foreign,
		country: country,
		reason: reason,
		source: source
	};
}

function apply_heuristics(seller, address_info, brand, trademark_data)
{
	const danger_color = "#b90000";
	const warn_color = "orange";
	const safe_color = "green";
	let brand_color = warn_color;
	let border_color = warn_color;
	let likeliness = "Unlikely";


	let heuristic_reasons = {
		trademark: "USPTO Trademark",
		company: "USPTO Company",
		seller: "Seller Address",
		heuristics: "Brand heuristic",
	};
	
	// Run heuristics on the brand
	let heuristics = is_chinese(brand, trademark_data, address_info[2]);

	if (heuristics["is_chinese"])
	{
		border_color = danger_color;
		brand_color = danger_color;
		
		// Trust USPTO data more than heuristics
		if (heuristics["reason"] == "trademark" || heuristics["reason"] == "company")
		{
			likeliness = "Yes";
		}
		else if (heuristics["reason"] == "heuristics")
		{
			likeliness = "Likely";
			
			// If the brand looks chinese and comes from China, flag it
			if (address_info[2].toLowerCase().includes("china"))
			{
				likeliness = "Yes";
			}
		}
		else if (heuristics["reason"] == "seller")
		{
			likeliness = "Likely";
		}
	}
	
	// Not chinese, but foreign
	if (!heuristics["is_chinese"] && heuristics["is_foreign"])
	{
		border_color = warn_color;
		brand_color = warn_color;
	}
	else if (heuristics["country"] == "US" || 
			address_info[2].toLowerCase().includes("usa") ||
			address_info[2].toLowerCase().includes("us") ||
			address_info[2].toLowerCase().includes("united states"))
	{
		border_color = safe_color;
		brand_color = safe_color;
		likeliness = "No";
	}
	
	
	let foreign_span = document.querySelector("#wtfforeign");
	let chinese_span = document.querySelector("#wtfchinese");
	let heur_span = document.querySelector("#wtfheur");
	let border_div = document.querySelector("#wtfborder");
	
	if (foreign_span != null)
	{
		foreign_span.replaceChildren(); // Delete spinner
		foreign_span.innerText = heuristics["is_foreign"] ? "Yes - " + heuristics["country"]  : "No";
	}
	
	if (chinese_span != null)
	{
		chinese_span.replaceChildren(); // Delete spinner
		
		let src_node = document.createElement("a");
		src_node.innerText = " (source)";
		src_node.href = heuristics["source"];
		
		let likeliness_span_node = document.createElement("span");
		likeliness_span_node.style = "color: " + brand_color;
		likeliness_span_node.innerText = likeliness;
		
		chinese_span.appendChild(likeliness_span_node);
		if (heuristics["source"] != "")
		{
			chinese_span.appendChild(src_node);
		}
	}
	
	if (heur_span != null)
	{
		heur_span.replaceChildren(); // Delete spinner
		if (heuristics["reason"] != "")
		{
			heur_span.innerText = heuristic_reasons[heuristics["reason"]];
		}
		else
		{
			heur_span.innerText = "none";
		}
	}
	
	if (border_div != null)
	{
		border_div.style = "border: 5px " + border_color + " solid"
	}
}

/**
	Adds a box above the "Add to cart" button
	
	@param seller: Name of seller
	@param address_info: [business name, business address, country]
	@param brand: Name of product brand
 */
function insertBox(seller, address_info, brand)
{
	let buy_it = document.querySelector("#desktop_buybox")
	let new_elem = document.createElement("div");

	new_elem.setAttribute("id", "wheres-that-from");
	new_elem.setAttribute("class", "celwidget");
	new_elem.innerHTML = `
<div class="celwidget" id="wheresthatfrombox">
	<div class="a-section a-spacing-mini">
		<div id="wtfborder" class="a-box a-spacing-none a-color-base-background a-text-left" style="border: 5px black solid">
			<div class="a-box-inner a-padding-base">
				<div class="a-row a-spacing-small bbop-grid-container">
					<div class="a-column a-span12 a-checkbox bbop-grid-container-checkbox">
						<span class="bbop-content" id="wheresthatfrominfo">
							<b>Brand Name:</b> ${brand}<br>
							<b>Foreign Brand?:</b> <span id="wtfforeign"><div class="wtf-spinner"></div></span><br>
							<b>Chinese Brand?:</b> <span id="wtfchinese"><div class="wtf-spinner"></div></span><br>
							<b>Heuristic:</b> <span id="wtfheur"><div class="wtf-spinner"></div></span>
							${ !trademarkLookupAllowed ? '<br><span class="a-size-small">Enable trademark data for more heuristics</span>' : '' }
							<br><br>
							<b>Seller:</b> ${seller}<br>
							<b>Business Name:</b> ${address_info[0]}<br>
							<b>Business Country:</b> ${address_info[2]}<br>
							<b>Business Address:</b> <span class="a-size-small">${address_info[1]}</span>
						</span>
					</div>
				</div>
			</div>
			<div style="text-align: right; margin-top: -50px;">
				<span>
					<small>Where's That From?</small>
				</span>
			</div>
		</div>
	</div>
</div>
`;

	buy_it.before(new_elem);
}

async function getData(url)
{
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Response status: ${response.status}`);
    }

	const text = await response.text();
	let dom = new DOMParser().parseFromString(text, 'text/html');
	
	return getAddress(dom);
}

function apply_observers()
{
	// Watch for updates due to picking a different variation of the product or a different offer or seller
	const buybox_node = document.querySelector("#desktop_buybox");
	const accordion_node = document.querySelector("#newAccordionRow_0");
	const used_node = document.querySelector("#usedAccordionRow");

	const config = {
		attributes: true, 
		childList: true, 
		characterData: false
	};
	  
	const callback = mutations => {  
		checkSeller();
	}

	observer = new MutationObserver(callback);

	observer.observe(buybox_node, config);
	
	if (accordion_node != null)
		observer.observe(accordion_node, config);

	if (used_node != null)
		observer.observe(used_node, config);

	// Some items have multiple variants with multiple offers, including re-sale, which break it
	// https://www.amazon.com/SABRENT-Docking-Station-Function-DS-UFNC/dp/B00LS5NFQ2/144-7102972-2376831

	/*
	If there's ever more than one offer, we may need to trigger on all accordion rows
	// Accordion nodes for multiple sellers or offers
	let accordion_nodes = document.querySelectorAll("[id^='newAccordionRow_']");
	accordion_nodes.forEach((node) => {
		observer.observe(node, config);
	});
	*/
}

async function checkSeller()
{
	// Prevent more callbacks until we've processed this one
	// The DOM may have changed which means we'll need new observers
	observer.disconnect();
	
	// Check if we're on a product page
	if (document.querySelector("#dp") == null)
		return;

	remove_box();

	// If there are multiple offers, they use an accordion layout instead
	let buy_row = document;
	let used = false;
	if (document.querySelector("#buyBoxAccordion") != null)
	{
		buy_row = document.querySelector("div.a-accordion-active");
		if (buy_row == null)
		{
			apply_observers();
			return;
		}
		
		if (buy_row.id == "usedAccordionRow")
		{
			used = true;
		}
	}

	let seller_href = null;
	let seller_info = [null, null];
	let is_amazon = false;

	// Get the seller block
	if (used)
	{
		// Re-sale items have a different layout than normal items
		let seller_elements = buy_row.querySelectorAll("#merchant-info > a");
		if (seller_elements.length == 0)
		{
			apply_observers();
			return;
		}

		seller_href = seller_elements[0];
	}
	else
	{
		let seller_elements = buy_row.querySelectorAll("div[data-csa-c-slot-id='odf-feature-text-desktop-merchant-info']");
		if (seller_elements.length == 0)
		{
			apply_observers();
			return;
		}
		
		let seller_span = seller_elements[0].querySelector("span.offer-display-feature-text-message");
		seller_href = seller_span.querySelector("#sellerProfileTriggerId");
		if (seller_href == null && seller_span.innerText == "Amazon.com")
			is_amazon = true;
	}
	
	// See who is selling it or if it's Amazon

	
	if (seller_href != null)
	{
		// It's a real seller, get their name and profile link
		seller_info = [seller_href.text, seller_href.href];
	}
	else if (is_amazon)
	{
		// It's Amazon selling it directly
		seller_info = ["Amazon.com", null];
	}


	//[business name, business address, country]
	let address_info = ["", "", ""];
	if (seller_info[1] != null)
	{
		if (seller_info[0] in seller_cache)
		{
			address_info = seller_cache[seller_info[0]];
		}
		else
		{
			try {
				address_info = await getData(seller_info[1]);
				seller_cache[seller_info[0]] = address_info;
			} catch (error) {
			  console.error(error.message);
			}
		}
	}
	else if (seller_info[0] == "Amazon.com")
	{
		address_info = ["Amazon.com", "", "United States"];
	}
	
	// Make a guess about the brand
	let brand = "";
	let byline = document.querySelector("#bylineInfo");
	let store_matches = byline.innerText.match(/Visit the (.*) Store/i);
	
	// Not everything has a store, might be "Brand: name" instead
	if (store_matches == null)
	{
		store_matches = byline.innerText.match(/Brand: (.*)/i);
	}
	
	if (store_matches != null && store_matches.length == 2)
		brand = store_matches[1];
	
	
	// Draw the box
	insertBox(seller_info[0], address_info, brand);

	// Get the trademark data
	const trademark_data = await getTrademarkData(brand);

	// Make informed decisions about the brand
	apply_heuristics(seller_info[0], address_info, brand, trademark_data);
	
	// Watch for DOM changes
	apply_observers();
}

async function getTrademarkData(brand)
{
	if (!trademarkLookupAllowed)
		return null;
		
	let data = new FormData();
	data.append("keyword", brand);

	let options = {
		method: "POST",
		mode: "cors",
		body: data
	};
    const response = await fetch("https://wheresthatfrom.org/api/v1/trademark", options);
    if (!response.ok) {
      console.log(`Response status: ${response.status}`);
	  return null;
    }

	const json = await response.json();
	
	return json;
}

async function checkTrademarkLookupsAllowed()
{
	await chrome.storage.sync.get("trademark")
		.then((value) => { 
			trademarkLookupAllowed = value["trademark"]
		});
}

injectCSS();
checkTrademarkLookupsAllowed();
apply_observers();
checkSeller();

