"""
historical_event_registry/parsers.py
"""
import logging
import os
from pathlib import Path
from typing import List, Dict, Any

logger = logging.getLogger(__name__)

# -- Verified 2023 dataset ----------------------------------------------------
PDF_2023_EVENTS: List[Dict[str, Any]] = [
    # FEBRUARY
    {"code": "BSG",  "month": "February",  "date_range": "February 8-9",      "location": "Singapore",                  "page": 1, "confidence": 0.95},
    {"code": "DRM",  "month": "February",  "date_range": "February 13-14",    "location": "Abu Dhabi, UAE",             "page": 1, "confidence": 0.95},
    {"code": "FCM",  "month": "February",  "date_range": "February 15-16",    "location": "Abu Dhabi, UAE",             "page": 1, "confidence": 0.95},
    {"code": "AFS",  "month": "February",  "date_range": "February 21-22",    "location": "League City, Texas",         "page": 1, "confidence": 0.95},
    {"code": "DDU",  "month": "February",  "date_range": "February 27-28",    "location": "Anaheim, California",        "page": 1, "confidence": 0.95},
    # MARCH
    {"code": "BTA",  "month": "March",     "date_range": "March 6-7",         "location": "Orange County, California",  "page": 1, "confidence": 0.90},
    {"code": "DSM",  "month": "March",     "date_range": "March 7",           "location": "",                           "page": 1, "confidence": 0.75},
    {"code": "REU",  "month": "March",     "date_range": "March 13-16",       "location": "Detroit, Michigan",          "page": 1, "confidence": 0.90},
    {"code": "LMA",  "month": "March",     "date_range": "March 13-16",       "location": "Detroit, Michigan",          "page": 1, "confidence": 0.90},
    {"code": "VTU",  "month": "March",     "date_range": "March 20-23",       "location": "Cambridge, Massachusetts",   "page": 1, "confidence": 0.85},
    {"code": "GSO",  "month": "March",     "date_range": "March 20-23",       "location": "Cambridge, Massachusetts",   "page": 1, "confidence": 0.85},
    {"code": "CCS",  "month": "March",     "date_range": "March 22-23",       "location": "Williamsburg, Pennsylvania", "page": 1, "confidence": 0.70},
    {"code": "AWC",  "month": "March",     "date_range": "March 28-29",       "location": "Willow Grove, Pennsylvania", "page": 1, "confidence": 0.80},
    {"code": "IBU",  "month": "March",     "date_range": "March 28-30",       "location": "Orange County, California",  "page": 1, "confidence": 0.85},
    # APRIL
    {"code": "PDE",  "month": "April",     "date_range": "April 3-5",         "location": "Calgary, Alberta",           "page": 1, "confidence": 0.85},
    {"code": "REFC", "month": "April",     "date_range": "April 5-6",         "location": "Calgary, Alberta",           "page": 1, "confidence": 0.75},
    {"code": "OIM",  "month": "April",     "date_range": "April 11-20",       "location": "Los Angeles, California",    "page": 1, "confidence": 0.75},
    {"code": "DIMI", "month": "April",     "date_range": "April 25-26",       "location": "Los Angeles, California",    "page": 1, "confidence": 0.65},
    {"code": "WNJ",  "month": "April",     "date_range": "April 26-27",       "location": "Los Angeles, California",    "page": 1, "confidence": 0.85},
    # MAY
    {"code": "DSM",  "month": "May",       "date_range": "May 2-4",           "location": "Los Angeles, California",    "page": 1, "confidence": 0.80},
    {"code": "SNU",  "month": "May",       "date_range": "May 3-4",           "location": "Los Angeles, California",    "page": 1, "confidence": 0.80},
    {"code": "WVE",  "month": "May",       "date_range": "May 8-9",           "location": "",                           "page": 1, "confidence": 0.70},
    {"code": "GWU",  "month": "May",       "date_range": "May 22-25",         "location": "Toronto, Ontario",           "page": 1, "confidence": 0.80},
    {"code": "WWAC", "month": "May",       "date_range": "May 22-25",         "location": "Toronto, Ontario",           "page": 1, "confidence": 0.80},
    {"code": "AUF",  "month": "May",       "date_range": "May 30-31",         "location": "Houston, Texas",             "page": 1, "confidence": 0.85},
    # JUNE
    {"code": "MNE",  "month": "June",      "date_range": "June 15-17",        "location": "London, UK",                 "page": 1, "confidence": 0.65},
    {"code": "BMU",  "month": "June",      "date_range": "June 26-27",        "location": "",                           "page": 1, "confidence": 0.60},
    {"code": "CCE",  "month": "June",      "date_range": "June 26-27",        "location": "",                           "page": 1, "confidence": 0.60},
    # JULY
    {"code": "AWE",  "month": "July",      "date_range": "July 10-11",        "location": "",                           "page": 1, "confidence": 0.55},
    {"code": "WSE",  "month": "July",      "date_range": "July 16-17",        "location": "",                           "page": 1, "confidence": 0.55},
    # AUGUST
    {"code": "PRO",  "month": "August",    "date_range": "August 6-10",       "location": "Buenos Aires, Argentina",    "page": 2, "confidence": 0.85},
    {"code": "BLBT", "month": "August",    "date_range": "August 8-9",        "location": "London, UK",                 "page": 2, "confidence": 0.85},
    {"code": "GFS",  "month": "August",    "date_range": "August 8-10",       "location": "Buenos Aires, Argentina",    "page": 2, "confidence": 0.85},
    {"code": "WAIS", "month": "August",    "date_range": "August 14-16",      "location": "Munich, Germany",            "page": 2, "confidence": 0.80},
    {"code": "MWO",  "month": "August",    "date_range": "August 28-29",      "location": "Boston, Massachusetts",      "page": 2, "confidence": 0.80},
    {"code": "REE",  "month": "August",    "date_range": "August 28-30",      "location": "",                           "page": 2, "confidence": 0.65},
    {"code": "DDF",  "month": "August",    "date_range": "August 28-29",      "location": "",                           "page": 2, "confidence": 0.65},
    # SEPTEMBER
    {"code": "BTE",  "month": "September", "date_range": "September 4-5",     "location": "Munich, Germany",            "page": 2, "confidence": 0.90},
    {"code": "PPTV", "month": "September", "date_range": "September 6-7",     "location": "Munich, Germany",            "page": 2, "confidence": 0.80},
    {"code": "GES",  "month": "September", "date_range": "September 7",       "location": "",                           "page": 2, "confidence": 0.70},
    {"code": "IRF",  "month": "September", "date_range": "September 13-14",   "location": "Calgary, Alberta",           "page": 2, "confidence": 0.90},
    {"code": "BIC",  "month": "September", "date_range": "September 18-19",   "location": "Toronto, Ontario",           "page": 2, "confidence": 0.90},
    {"code": "WLC",  "month": "September", "date_range": "September 20-21",   "location": "Toronto, Ontario",           "page": 2, "confidence": 0.90},
    {"code": "CUF",  "month": "September", "date_range": "September 25-26",   "location": "Calgary, Alberta",           "page": 2, "confidence": 0.90},
    # OCTOBER
    {"code": "WWME", "month": "October",   "date_range": "October 16-17",     "location": "Abu Dhabi, UAE",             "page": 2, "confidence": 0.90},
    {"code": "WEEM", "month": "October",   "date_range": "October 18-19",     "location": "Abu Dhabi, UAE",             "page": 2, "confidence": 0.80},
    {"code": "REE",  "month": "October",   "date_range": "October 23-24",     "location": "Houston, Texas",             "page": 2, "confidence": 0.85},
    {"code": "CCU",  "month": "October",   "date_range": "October 23-24",     "location": "Houston, Texas",             "page": 2, "confidence": 0.85},
    {"code": "PBU",  "month": "October",   "date_range": "October 25-28",     "location": "Houston, Texas",             "page": 2, "confidence": 0.85},
    {"code": "BIE",  "month": "October",   "date_range": "October 25-28",     "location": "Frankfurt, Germany",         "page": 2, "confidence": 0.85},
    # NOVEMBER
    {"code": "AVE",  "month": "November",  "date_range": "November 13-14",    "location": "Berlin, Germany",            "page": 2, "confidence": 0.90},
    {"code": "VHE",  "month": "November",  "date_range": "November 13-16",    "location": "Berlin, Germany",            "page": 2, "confidence": 0.85},
    {"code": "SGU",  "month": "November",  "date_range": "November 13-14",    "location": "Los Angeles, California",    "page": 2, "confidence": 0.85},
    {"code": "SSU",  "month": "November",  "date_range": "November 15-16",    "location": "Los Angeles, California",    "page": 2, "confidence": 0.85},
    # DECEMBER
    {"code": "DIM",  "month": "December",  "date_range": "December 11-12",    "location": "Singapore",                  "page": 2, "confidence": 0.90},
    {"code": "DLU",  "month": "December",  "date_range": "December 12-13",    "location": "California, USA",            "page": 2, "confidence": 0.85},
    {"code": "WDSS", "month": "December",  "date_range": "December 13-14",    "location": "Detroit, Michigan",          "page": 2, "confidence": 0.75},
    {"code": "HTU",  "month": "December",  "date_range": "December 13-14",    "location": "Los Angeles, California",    "page": 2, "confidence": 0.90},
]

# -- Verified 2024 dataset ----------------------------------------------------
PDF_2024_EVENTS: List[Dict[str, Any]] = [
    # FEBRUARY
    {"code": "AFS",  "month": "February",  "date_range": "February 12-13",    "location": "Houston, Texas, USA",          "page": 1, "confidence": 0.95},
    {"code": "DDU",  "month": "February",  "date_range": "February 28-29",    "location": "Los Angeles, California, USA", "page": 1, "confidence": 0.95},
    {"code": "BISG", "month": "February",  "date_range": "February 28-29",    "location": "Singapore",                    "page": 1, "confidence": 0.95},
    # MARCH
    {"code": "CCM",  "month": "March",     "date_range": "March 4-5",         "location": "Dubai, UAE",                   "page": 1, "confidence": 0.95},
    {"code": "DOU",  "month": "March",     "date_range": "March 4-5",         "location": "Houston, Texas, USA",          "page": 1, "confidence": 0.95},
    {"code": "BIM",  "month": "March",     "date_range": "March 6-7",         "location": "Dubai, UAE",                   "page": 1, "confidence": 0.70},
    {"code": "CPU",  "month": "March",     "date_range": "March 6-7",         "location": "Houston, Texas",               "page": 1, "confidence": 0.70},
    {"code": "CCZ",  "month": "March",     "date_range": "March 11-12",       "location": "Perth, Australia",             "page": 1, "confidence": 0.70},
    {"code": "BNZ",  "month": "March",     "date_range": "March 13-14",       "location": "Perth, Australia",             "page": 1, "confidence": 0.70},
    {"code": "BIU",  "month": "March",     "date_range": "March 13-14",       "location": "Orange County, California",    "page": 1, "confidence": 0.95},
    {"code": "WLU",  "month": "March",     "date_range": "March 18-19",       "location": "Los Angeles, California, USA", "page": 1, "confidence": 0.95},
    {"code": "WLZ",  "month": "March",     "date_range": "March 18-19",       "location": "Melbourne, Australia",         "page": 1, "confidence": 0.95},
    {"code": "AVU",  "month": "March",     "date_range": "March 20-21",       "location": "Los Angeles, California, USA", "page": 1, "confidence": 0.95},
    {"code": "BFU",  "month": "March",     "date_range": "March 25-26",       "location": "Detroit, Michigan",            "page": 1, "confidence": 0.70},
    {"code": "REU",  "month": "March",     "date_range": "March 27-28",       "location": "Detroit, Michigan, USA",       "page": 1, "confidence": 0.95},
    # APRIL
    {"code": "EAU",  "month": "April",     "date_range": "April 1-2",         "location": "Los Angeles, California, USA", "page": 1, "confidence": 0.95},
    {"code": "BCU",  "month": "April",     "date_range": "April 3-4",         "location": "Los Angeles, California",      "page": 1, "confidence": 0.70},
    {"code": "SIU",  "month": "April",     "date_range": "April 8-9",         "location": "Detroit, Michigan",            "page": 1, "confidence": 0.70},
    {"code": "ALF",  "month": "April",     "date_range": "April 9-10",        "location": "Houston, Texas, USA",          "page": 1, "confidence": 0.95},
    {"code": "HMU",  "month": "April",     "date_range": "April 10-11",       "location": "Detroit, Michigan, USA",       "page": 1, "confidence": 0.70},
    {"code": "BIUK", "month": "April",     "date_range": "April 15-16",       "location": "London, UK",                   "page": 1, "confidence": 0.95},
    {"code": "WMC",  "month": "April",     "date_range": "April 15-16",       "location": "Calgary, Canada",              "page": 1, "confidence": 0.70},
    {"code": "DSM",  "month": "April",     "date_range": "April 17-18",       "location": "London, UK",                   "page": 1, "confidence": 0.95},
    {"code": "REFC", "month": "April",     "date_range": "April 17-18",       "location": "Calgary, Canada",              "page": 1, "confidence": 0.70},
    {"code": "MBU",  "month": "April",     "date_range": "April 24-25",       "location": "Boston, Massachusetts",        "page": 1, "confidence": 0.70},
    # MAY
    {"code": "CCC",  "month": "May",       "date_range": "May 6-7",           "location": "Calgary, Canada",              "page": 1, "confidence": 0.95},
    {"code": "BIT",  "month": "May",       "date_range": "May 6-7",           "location": "Bangkok, Thailand",            "page": 1, "confidence": 0.70},
    {"code": "WWT",  "month": "May",       "date_range": "May 8-9",           "location": "Bangkok, Thailand",            "page": 1, "confidence": 0.70},
    {"code": "BNC",  "month": "May",       "date_range": "May 13-14",         "location": "Toronto, Canada",              "page": 1, "confidence": 0.95},
    {"code": "DLG",  "month": "May",       "date_range": "May 13-14",         "location": "Buenos Aires, Argentina",      "page": 1, "confidence": 0.95},
    {"code": "SPE",  "month": "May",       "date_range": "May 13-14",         "location": "Frankfurt, Germany",           "page": 1, "confidence": 0.95},
    {"code": "WLC",  "month": "May",       "date_range": "May 15-16",         "location": "Toronto, Canada",              "page": 1, "confidence": 0.70},
    {"code": "MSE",  "month": "May",       "date_range": "May 15-16",         "location": "Frankfurt, Germany",           "page": 1, "confidence": 0.70},
    {"code": "LMA",  "month": "May",       "date_range": "May 20-21",         "location": "Detroit, Michigan, USA",       "page": 1, "confidence": 0.95},
    {"code": "FCM",  "month": "May",       "date_range": "May 27-28",         "location": "Dubai, UAE",                   "page": 1, "confidence": 0.95},
    {"code": "DOM",  "month": "May",       "date_range": "May 29-30",         "location": "Dubai, UAE",                   "page": 1, "confidence": 0.70},
    # JUNE
    {"code": "CCE",  "month": "June",      "date_range": "June 3-4",          "location": "Amsterdam, The Netherlands",   "page": 1, "confidence": 0.95},
    {"code": "BTA",  "month": "June",      "date_range": "June 3-4",          "location": "Los Angeles, California, USA", "page": 1, "confidence": 0.95},
    {"code": "WLE",  "month": "June",      "date_range": "June 5-6",          "location": "Amsterdam, The Netherlands",   "page": 1, "confidence": 0.95},
    {"code": "HFU",  "month": "June",      "date_range": "June 5-6",          "location": "Los Angeles, California, USA", "page": 1, "confidence": 0.95},
    {"code": "OAU",  "month": "June",      "date_range": "June 10-11",        "location": "Houston, Texas, USA",          "page": 1, "confidence": 0.70},
    {"code": "RESG", "month": "June",      "date_range": "June 24-25",        "location": "Singapore",                    "page": 1, "confidence": 0.70},
    {"code": "DDE",  "month": "June",      "date_range": "June 24-25",        "location": "Frankfurt, Germany",           "page": 1, "confidence": 0.95},
    {"code": "MRE",  "month": "June",      "date_range": "June 26-27",        "location": "Frankfurt, Germany",           "page": 1, "confidence": 0.95},
    # JULY
    {"code": "PPTX", "month": "July",      "date_range": "July 8-9",          "location": "Houston, Texas, USA",          "page": 1, "confidence": 0.95},
    {"code": "BIC",  "month": "July",      "date_range": "July 10-11",        "location": "Toronto, Canada",              "page": 1, "confidence": 0.95},
    {"code": "EFU",  "month": "July",      "date_range": "July 10-11",        "location": "Houston, Texas, USA",          "page": 1, "confidence": 0.70},
    {"code": "CLF",  "month": "July",      "date_range": "July 15-16",        "location": "Calgary, Canada",              "page": 1, "confidence": 0.95},
    {"code": "DSU",  "month": "July",      "date_range": "July 15-16",        "location": "Miami, Florida, USA",          "page": 1, "confidence": 0.70},
    {"code": "DLC",  "month": "July",      "date_range": "July 17-18",        "location": "Calgary, Canada",              "page": 1, "confidence": 0.95},
    {"code": "WAU",  "month": "July",      "date_range": "July 17-18",        "location": "Miami, Florida, USA",          "page": 1, "confidence": 0.70},
    {"code": "BZU",  "month": "July",      "date_range": "July 22-23",        "location": "Orange County, California",    "page": 1, "confidence": 0.70},
    {"code": "ETU",  "month": "July",      "date_range": "July 24-25",        "location": "Orange County, California",    "page": 1, "confidence": 0.70},
    {"code": "WMA",  "month": "July",      "date_range": "July 29-30",        "location": "Houston, Texas, USA",          "page": 1, "confidence": 0.95},
    {"code": "MSE",  "month": "July",      "date_range": "July 29-30",        "location": "Frankfurt, Germany",           "page": 1, "confidence": 0.70},
    # AUGUST
    {"code": "OBU",  "month": "August",    "date_range": "August 6-7",        "location": "Boston, Massachusetts",        "page": 2, "confidence": 0.70},
    {"code": "HZU",  "month": "August",    "date_range": "August 12-13",      "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.95},
    {"code": "OAU",  "month": "August",    "date_range": "August 14-15",      "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.95},
    {"code": "ETU",  "month": "August",    "date_range": "August 19-20",      "location": "Orange County, California",    "page": 2, "confidence": 0.70},
    {"code": "PRB",  "month": "August",    "date_range": "August 19-20",      "location": "Rio de Janeiro, Brazil",       "page": 2, "confidence": 0.70},
    {"code": "BIM",  "month": "August",    "date_range": "August 19-20",      "location": "Dubai, UAE",                   "page": 2, "confidence": 0.70},
    {"code": "BZU",  "month": "August",    "date_range": "August 21-22",      "location": "Orange County, California",    "page": 2, "confidence": 0.70},
    {"code": "EFU",  "month": "August",    "date_range": "August 26-27",      "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.95},
    {"code": "BIP",  "month": "August",    "date_range": "August 26-27",      "location": "Manila, Philippines",          "page": 2, "confidence": 0.70},
    {"code": "WWP",  "month": "August",    "date_range": "August 28-29",      "location": "Manila, Philippines",          "page": 2, "confidence": 0.70},
    # SEPTEMBER
    {"code": "DLE",  "month": "September", "date_range": "September 2-3",     "location": "Munich, Germany",              "page": 2, "confidence": 0.95},
    {"code": "LFU",  "month": "September", "date_range": "September 4-5",     "location": "Detroit, Michigan, USA",       "page": 2, "confidence": 0.95},
    {"code": "EAE",  "month": "September", "date_range": "September 4-5",     "location": "Munich, Germany",              "page": 2, "confidence": 0.70},
    {"code": "CFS",  "month": "September", "date_range": "September 9-10",    "location": "Calgary, Canada",              "page": 2, "confidence": 0.95},
    {"code": "REF",  "month": "September", "date_range": "September 9-10",    "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.95},
    {"code": "BTE",  "month": "September", "date_range": "September 9-10",    "location": "Frankfurt, Germany",           "page": 2, "confidence": 0.70},
    {"code": "DOC",  "month": "September", "date_range": "September 11-12",   "location": "Calgary, Canada",              "page": 2, "confidence": 0.95},
    {"code": "HDU",  "month": "September", "date_range": "September 11-12",   "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.95},
    {"code": "BIE",  "month": "September", "date_range": "September 11-12",   "location": "Frankfurt, Germany",           "page": 2, "confidence": 0.70},
    {"code": "MSE",  "month": "September", "date_range": "September 11-12",   "location": "Frankfurt, Germany",           "page": 2, "confidence": 0.70},
    {"code": "SPU",  "month": "September", "date_range": "September 16-17",   "location": "Orange County, California",    "page": 2, "confidence": 0.95},
    {"code": "WIU",  "month": "September", "date_range": "September 18-19",   "location": "Orange County, California",    "page": 2, "confidence": 0.95},
    {"code": "RGU",  "month": "September", "date_range": "September 23-24",   "location": "Orange County, California",    "page": 2, "confidence": 0.70},
    {"code": "WMM",  "month": "September", "date_range": "September 23-24",   "location": "Dubai, UAE",                   "page": 2, "confidence": 0.95},
    {"code": "PRM",  "month": "September", "date_range": "September 25",      "location": "Dubai, UAE",                   "page": 2, "confidence": 0.95},
    {"code": "ACU",  "month": "September", "date_range": "September 25-26",   "location": "Orange County, California",    "page": 2, "confidence": 0.70},
    {"code": "POU",  "month": "September", "date_range": "September 25-26",   "location": "Orange County, California",    "page": 2, "confidence": 0.70},
    # OCTOBER
    {"code": "REE",  "month": "October",   "date_range": "October 7-8",       "location": "Frankfurt, Germany",           "page": 2, "confidence": 0.95},
    {"code": "FCU",  "month": "October",   "date_range": "October 7-8",       "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.95},
    {"code": "BNZ",  "month": "October",   "date_range": "October 7-8",       "location": "Perth, Australia",             "page": 2, "confidence": 0.95},
    {"code": "MRU",  "month": "October",   "date_range": "October 7-8",       "location": "Boston, Massachusetts, USA",   "page": 2, "confidence": 0.95},
    {"code": "CCZ",  "month": "October",   "date_range": "October 9-10",      "location": "Perth, Australia",             "page": 2, "confidence": 0.95},
    {"code": "BIE",  "month": "October",   "date_range": "October 9-10",      "location": "Frankfurt, Germany",           "page": 2, "confidence": 0.95},
    {"code": "AMU",  "month": "October",   "date_range": "October 9",         "location": "Boston, Massachusetts, USA",   "page": 2, "confidence": 0.95},
    {"code": "STU",  "month": "October",   "date_range": "October 9-10",      "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.95},
    {"code": "CCU",  "month": "October",   "date_range": "October 15-16",     "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.95},
    {"code": "AIU",  "month": "October",   "date_range": "October 17-18",     "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.70},
    {"code": "PAU",  "month": "October",   "date_range": "October 21-22",     "location": "Orange County, California",    "page": 2, "confidence": 0.95},
    {"code": "FZU",  "month": "October",   "date_range": "October 23-24",     "location": "Orange County, California",    "page": 2, "confidence": 0.70},
    {"code": "SGU",  "month": "October",   "date_range": "October 28-29",     "location": "Orange County, California",    "page": 2, "confidence": 0.95},
    {"code": "BAU",  "month": "October",   "date_range": "October 30",        "location": "Orange County, California",    "page": 2, "confidence": 0.95},
    # NOVEMBER
    {"code": "SCU",  "month": "November",  "date_range": "November 4-5",      "location": "Miami, Florida, USA",          "page": 2, "confidence": 0.70},
    {"code": "AVE",  "month": "November",  "date_range": "November 4-5",      "location": "Frankfurt, Germany",           "page": 2, "confidence": 0.95},
    {"code": "FFU",  "month": "November",  "date_range": "November 4-5",      "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.70},
    {"code": "SRU",  "month": "November",  "date_range": "November 6-7",      "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.70},
    {"code": "LRU",  "month": "November",  "date_range": "November 6-7",      "location": "Miami, Florida, USA",          "page": 2, "confidence": 0.70},
    {"code": "DSU",  "month": "November",  "date_range": "November 6-7",      "location": "Miami, Florida, USA",          "page": 2, "confidence": 0.95},
    {"code": "AFU",  "month": "November",  "date_range": "November 13-14",    "location": "Los Angeles, California",      "page": 2, "confidence": 0.70},
    {"code": "FFU",  "month": "November",  "date_range": "November 13-14",    "location": "Houston, Texas, USA",          "page": 2, "confidence": 0.70},
    {"code": "MDU",  "month": "November",  "date_range": "November 18-19",    "location": "Boston, Massachusetts, USA",   "page": 2, "confidence": 0.70},
    {"code": "THU",  "month": "November",  "date_range": "November 18-19",    "location": "Los Angeles, California",      "page": 2, "confidence": 0.70},
    {"code": "BPU",  "month": "November",  "date_range": "November 20-21",    "location": "Boston, Massachusetts, USA",   "page": 2, "confidence": 0.70},
    {"code": "PSU",  "month": "November",  "date_range": "November 20-21",    "location": "Los Angeles, California",      "page": 2, "confidence": 0.95},
    {"code": "SGE",  "month": "November",  "date_range": "November 25-26",    "location": "Frankfurt, Germany",           "page": 2, "confidence": 0.70},
    {"code": "WWI",  "month": "November",  "date_range": "November 25-26",    "location": "Jakarta, Indonesia",           "page": 2, "confidence": 0.70},
    {"code": "BII",  "month": "November",  "date_range": "November 27-28",    "location": "Jakarta, Indonesia",           "page": 2, "confidence": 0.70},
    {"code": "HFE",  "month": "November",  "date_range": "November 27-28",    "location": "Frankfurt, Germany",           "page": 2, "confidence": 0.70},
    # DECEMBER
    {"code": "DLU",  "month": "December",  "date_range": "December 2-3",      "location": "Orange County, California",    "page": 2, "confidence": 0.95},
    {"code": "BIZ",  "month": "December",  "date_range": "December 2-3",      "location": "Melbourne, Australia",         "page": 2, "confidence": 0.95},
    {"code": "SSU",  "month": "December",  "date_range": "December 4-5",      "location": "Los Angeles, California",      "page": 2, "confidence": 0.70},
    {"code": "WTTZ", "month": "December",  "date_range": "December 4-5",      "location": "Preston, Australia",           "page": 2, "confidence": 0.70},
    {"code": "WTTE", "month": "December",  "date_range": "December 9-10",     "location": "Amsterdam, The Netherlands",   "page": 2, "confidence": 0.95},
    {"code": "PRZ",  "month": "December",  "date_range": "December 9-10",     "location": "Perth, Australia",             "page": 2, "confidence": 0.70},
    {"code": "VFU",  "month": "December",  "date_range": "December 9-10",     "location": "Orange County, California",    "page": 2, "confidence": 0.70},
    {"code": "POU",  "month": "December",  "date_range": "December 11-12",    "location": "Orange County, California",    "page": 2, "confidence": 0.70},
    {"code": "WSE",  "month": "December",  "date_range": "December 11-12",    "location": "Amsterdam, The Netherlands",   "page": 2, "confidence": 0.70},
    {"code": "LRU",  "month": "December",  "date_range": "December 16-17",    "location": "Miami, Florida, USA",          "page": 2, "confidence": 0.70},
]


class Historical2023PDFImporter:
    PDF_FILENAME = "2023.pdf"

    def __init__(self, pdf_path=None):
        if pdf_path is None:
            from django.conf import settings
            pdf_path = str(Path(settings.BASE_DIR) / "data" / "pdfs" / self.PDF_FILENAME)
        self.pdf_path = pdf_path

    def extract(self):
        if os.path.isfile(self.pdf_path):
            try:
                rows = self._extract_from_pdf()
                if rows:
                    return rows
            except Exception as exc:
                logger.warning("2023 PDF extraction failed (%s); using hardcoded dataset.", exc)
        else:
            logger.info("2023 PDF not found -- using hardcoded dataset.")
        return self._hardcoded_rows()

    def _extract_from_pdf(self):
        try:
            import pdfplumber
        except ImportError:
            return []
        rows = []
        month_upper = {m.upper(): m for m in [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]}
        current_month = None
        with pdfplumber.open(self.pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                for table in (page.extract_tables() or []):
                    for row in table:
                        if not row or all(not (c or "").strip() for c in row):
                            continue
                        first = (row[0] or "").strip().upper()
                        if first in month_upper:
                            current_month = month_upper[first]
                            continue
                        if not current_month:
                            continue
                        code_raw = (row[0] or "").strip()
                        if not code_raw or len(code_raw) > 10:
                            continue
                        if code_raw.upper() in ("CODE", "EVENT", "DATES", "DATE"):
                            continue
                        rows.append({
                            "code": code_raw,
                            "month": current_month,
                            "date_range": (row[1] or "").strip() if len(row) > 1 else "",
                            "location":   (row[2] or "").strip() if len(row) > 2 else "",
                            "page": page_num,
                            "confidence": 0.70,
                        })
        return rows

    def _hardcoded_rows(self):
        return [dict(r) for r in PDF_2023_EVENTS]


class Historical2024PDFImporter:
    PDF_FILENAME = "2024.pdf"

    def __init__(self, pdf_path=None):
        if pdf_path is None:
            from django.conf import settings
            pdf_path = str(Path(settings.BASE_DIR) / "data" / "pdfs" / self.PDF_FILENAME)
        self.pdf_path = pdf_path

    def extract(self):
        if os.path.isfile(self.pdf_path):
            try:
                rows = self._extract_from_pdf()
                if rows:
                    return rows
            except Exception as exc:
                logger.warning("2024 PDF extraction failed (%s); using hardcoded dataset.", exc)
        else:
            logger.info("2024 PDF not found -- using hardcoded dataset.")
        return self._hardcoded_rows()

    def _extract_from_pdf(self):
        try:
            import pdfplumber
        except ImportError:
            return []
        rows = []
        month_upper = {m.upper(): m for m in [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]}
        current_month = None
        with pdfplumber.open(self.pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                for table in (page.extract_tables() or []):
                    for row in table:
                        if not row or all(not (c or "").strip() for c in row):
                            continue
                        first = (row[0] or "").strip().upper()
                        if first in month_upper:
                            current_month = month_upper[first]
                            continue
                        if not current_month:
                            continue
                        code_raw = (row[0] or "").strip()
                        if not code_raw or len(code_raw) > 10:
                            continue
                        if code_raw.upper() in ("CODE", "EVENT", "DATES", "DATE"):
                            continue
                        rows.append({
                            "code": code_raw,
                            "month": current_month,
                            "date_range": (row[1] or "").strip() if len(row) > 1 else "",
                            "location":   (row[2] or "").strip() if len(row) > 2 else "",
                            "page": page_num,
                            "confidence": 0.70,
                        })
        return rows

    def _hardcoded_rows(self):
        return [dict(r) for r in PDF_2024_EVENTS]


# ── 2025 dataset — populated after CSV import ─────────────────────────────────
# Codes are in "DDU - PT" format; normalize_event_code() strips the suffix.
PDF_2025_EVENTS: list = [
    # ── February ──────────────────────────────────────────────────────────────
    {"code": "DDU - PT",   "month": "February",  "date_range": "February 3-4",       "location": "San Diego, California",           "page": 1, "confidence": 0.90},
    {"code": "BISG - PM",  "month": "February",  "date_range": "February 5-6",       "location": "Singapore",                       "page": 1, "confidence": 0.90},
    {"code": "AFS - JS",   "month": "February",  "date_range": "February 10-11",     "location": "Houston, Texas",                  "page": 1, "confidence": 0.90},
    {"code": "CPU - VV",   "month": "February",  "date_range": "February 18-19",     "location": "Houston, Texas",                  "page": 1, "confidence": 0.90},
    {"code": "WLZ - MP",   "month": "February",  "date_range": "February 24-25",     "location": "Melbourne, Australia",            "page": 1, "confidence": 0.90},
    {"code": "WSU - MP",   "month": "February",  "date_range": "February 24-25",     "location": "Orange County, California",       "page": 1, "confidence": 0.90},
    {"code": "THZ - LN",   "month": "February",  "date_range": "February 26-27",     "location": "Melbourne, Australia",            "page": 1, "confidence": 0.90},
    {"code": "HIU - VV",   "month": "February",  "date_range": "February 26-27",     "location": "Orange County, California",       "page": 1, "confidence": 0.90},
    # ── March ─────────────────────────────────────────────────────────────────
    {"code": "BIU - PM",   "month": "March",     "date_range": "March 3-4",          "location": "Los Angeles, California, USA",    "page": 1, "confidence": 0.90},
    {"code": "DOU - JS",   "month": "March",     "date_range": "March 3-4",          "location": "Houston, Texas, USA",             "page": 1, "confidence": 0.90},
    {"code": "VPU - VV",   "month": "March",     "date_range": "March 5-6",          "location": "Houston, Texas, USA",             "page": 1, "confidence": 0.90},
    {"code": "BTA - RS",   "month": "March",     "date_range": "March 5-6",          "location": "Los Angeles, California, USA",    "page": 1, "confidence": 0.90},
    {"code": "ROU - LN",   "month": "March",     "date_range": "March 10-11",        "location": "League City, Texas, USA",         "page": 1, "confidence": 0.90},
    {"code": "FOU - AD",   "month": "March",     "date_range": "March 10-11",        "location": "Orange County, California, USA",  "page": 1, "confidence": 0.90},
    {"code": "WLU - MP",   "month": "March",     "date_range": "March 12-13",        "location": "Orange County, California, USA",  "page": 1, "confidence": 0.90},
    {"code": "BGU - AD",   "month": "March",     "date_range": "March 12-13",        "location": "League City, Texas, USA",         "page": 1, "confidence": 0.90},
    {"code": "ODU - AC",   "month": "March",     "date_range": "March 17-18",        "location": "Boston, Massachusetts",           "page": 1, "confidence": 0.90},
    {"code": "TIU - AC",   "month": "March",     "date_range": "March 19-20",        "location": "Boston, Massachusetts",           "page": 1, "confidence": 0.90},
    {"code": "REU - RS",   "month": "March",     "date_range": "March 24-25",        "location": "Detroit, Michigan, USA",          "page": 1, "confidence": 0.90},
    {"code": "AVU - RS",   "month": "March",     "date_range": "March 24-25",        "location": "Los Angeles, California, USA",    "page": 1, "confidence": 0.90},
    {"code": "DAU - AD",   "month": "March",     "date_range": "March 26-27",        "location": "Orange County, California, USA",  "page": 1, "confidence": 0.90},
    # ── April ─────────────────────────────────────────────────────────────────
    {"code": "FPU - AC",   "month": "April",     "date_range": "March 31 - Apr 1",   "location": "Boston, Massachusetts",           "page": 1, "confidence": 0.90},
    {"code": "EAU - RS",   "month": "April",     "date_range": "March 31 - Apr 1",   "location": "Orange County, California",       "page": 1, "confidence": 0.90},
    {"code": "SFU - AD",   "month": "April",     "date_range": "April 2-3",          "location": "Orange County, California",       "page": 1, "confidence": 0.90},
    {"code": "CRU - AC",   "month": "April",     "date_range": "April 2-3",          "location": "Boston, Massachusetts",           "page": 1, "confidence": 0.90},
    {"code": "PFU - AD",   "month": "April",     "date_range": "April 7-8",          "location": "Chicago, Illinois",               "page": 1, "confidence": 0.90},
    {"code": "BLU - AD",   "month": "April",     "date_range": "April 9-10",         "location": "Chicago, Illinois",               "page": 1, "confidence": 0.90},
    {"code": "LMU - RS",   "month": "April",     "date_range": "April 14-15",        "location": "Detroit, Michigan",               "page": 1, "confidence": 0.90},
    {"code": "WRU - MP",   "month": "April",     "date_range": "April 14-15",        "location": "Miami, Florida",                  "page": 1, "confidence": 0.90},
    {"code": "WLSU - MP",  "month": "April",     "date_range": "April 16-17",        "location": "Miami, Florida",                  "page": 1, "confidence": 0.90},
    {"code": "SDU - RS",   "month": "April",     "date_range": "April 16-17",        "location": "Detroit, Michigan",               "page": 1, "confidence": 0.90},
    {"code": "BNM - RS",   "month": "April",     "date_range": "April 21-22",        "location": "Dubai, UAE",                      "page": 1, "confidence": 0.90},
    {"code": "CCM - VV",   "month": "April",     "date_range": "April 23-24",        "location": "Dubai, UAE",                      "page": 1, "confidence": 0.90},
    {"code": "HAU - LN",   "month": "April",     "date_range": "April 28-29",        "location": "Orange County, California",       "page": 1, "confidence": 0.90},
    {"code": "EGU - VV",   "month": "April",     "date_range": "April 28-29",        "location": "Houston, Texas",                  "page": 1, "confidence": 0.90},
    {"code": "MMU - JS",   "month": "April",     "date_range": "April 30 - May 1",   "location": "Houston, Texas",                  "page": 1, "confidence": 0.90},
    # ── May ───────────────────────────────────────────────────────────────────
    {"code": "DOM - JS",   "month": "May",       "date_range": "May 5-6",            "location": "Dubai, UAE",                      "page": 1, "confidence": 0.90},
    {"code": "HIE - VV",   "month": "May",       "date_range": "May 5-6",            "location": "Frankfurt, Germany",              "page": 1, "confidence": 0.90},
    {"code": "BNC - RS",   "month": "May",       "date_range": "May 5-6",            "location": "Toronto, Canada",                 "page": 1, "confidence": 0.90},
    {"code": "FCM - JS",   "month": "May",       "date_range": "May 7",              "location": "Dubai, UAE",                      "page": 1, "confidence": 0.90},
    {"code": "SPE - VV",   "month": "May",       "date_range": "May 7-8",            "location": "Frankfurt, Germany",              "page": 1, "confidence": 0.90},
    {"code": "WLKC - MP",  "month": "May",       "date_range": "May 12-13",          "location": "Calgary, Alberta",                "page": 1, "confidence": 0.90},
    {"code": "WMC - JS",   "month": "May",       "date_range": "May 14-15",          "location": "Calgary, Alberta",                "page": 1, "confidence": 0.90},
    {"code": "DLG - VV",   "month": "May",       "date_range": "May 19-20",          "location": "Buenos Aires, Argentina",         "page": 1, "confidence": 0.90},
    {"code": "EFE - VV",   "month": "May",       "date_range": "May 19-20",          "location": "Frankfurt, Germany",              "page": 1, "confidence": 0.90},
    {"code": "GGE - RS",   "month": "May",       "date_range": "May 21-22",          "location": "Frankfurt, Germany",              "page": 1, "confidence": 0.90},
    {"code": "PRG - JS",   "month": "May",       "date_range": "May 21-22",          "location": "Buenos Aires, Argentina",         "page": 1, "confidence": 0.90},
    {"code": "OMU - LN",   "month": "May",       "date_range": "May 27-28",          "location": "Miami, Florida",                  "page": 1, "confidence": 0.90},
    # ── June ──────────────────────────────────────────────────────────────────
    {"code": "BIUK - PM",  "month": "June",      "date_range": "June 2-3",           "location": "London, UK",                      "page": 2, "confidence": 0.90},
    {"code": "VVU - PT",   "month": "June",      "date_range": "June 2-3",           "location": "San Diego, California",           "page": 2, "confidence": 0.90},
    {"code": "CCC - VV",   "month": "June",      "date_range": "June 2-3",           "location": "Calgary, Alberta",                "page": 2, "confidence": 0.90},
    {"code": "STE - LN",   "month": "June",      "date_range": "June 4-5",           "location": "London, UK",                      "page": 2, "confidence": 0.90},
    {"code": "PRU - PT",   "month": "June",      "date_range": "June 4-5",           "location": "San Diego, California",           "page": 2, "confidence": 0.90},
    {"code": "CFS - JS",   "month": "June",      "date_range": "June 4-5",           "location": "Calgary, Alberta",                "page": 2, "confidence": 0.90},
    {"code": "BDU - AD",   "month": "June",      "date_range": "June 9-10",          "location": "Orange County, California",       "page": 2, "confidence": 0.90},
    {"code": "DAU - AD",   "month": "June",      "date_range": "June 11-12",         "location": "Orange County, California",       "page": 2, "confidence": 0.90},
    {"code": "AVU - RS",   "month": "June",      "date_range": "June 11-12",         "location": "Orange County, California",       "page": 2, "confidence": 0.90},
    {"code": "MRE - PT",   "month": "June",      "date_range": "June 16-17",         "location": "Berlin, Germany",                 "page": 2, "confidence": 0.90},
    {"code": "TIE - PT",   "month": "June",      "date_range": "June 18-19",         "location": "Berlin, Germany",                 "page": 2, "confidence": 0.90},
    {"code": "HFU - RS",   "month": "June",      "date_range": "June 23-24",         "location": "Anaheim, California",             "page": 2, "confidence": 0.90},
    {"code": "WLKE - MP",  "month": "June",      "date_range": "June 23-24",         "location": "Amsterdam, The Netherlands",      "page": 2, "confidence": 0.90},
    {"code": "FOU - AD",   "month": "June",      "date_range": "June 25-26",         "location": "Anaheim, California",             "page": 2, "confidence": 0.90},
    {"code": "CCE - VV",   "month": "June",      "date_range": "June 25-26",         "location": "Amsterdam, The Netherlands",      "page": 2, "confidence": 0.90},
    # ── July ──────────────────────────────────────────────────────────────────
    {"code": "PPTX - JS",  "month": "July",      "date_range": "June 30-July 1",     "location": "Houston, Texas",                  "page": 2, "confidence": 0.90},
    {"code": "WCU - MP",   "month": "July",      "date_range": "July 1-2",           "location": "Orange County, California",       "page": 2, "confidence": 0.90},
    {"code": "HZU - VV",   "month": "July",      "date_range": "July 2-3",           "location": "Houston, Texas",                  "page": 2, "confidence": 0.90},
    {"code": "WMA - JS",   "month": "July",      "date_range": "July 7-8",           "location": "Houston, Texas",                  "page": 2, "confidence": 0.90},
    {"code": "SGC - PM",   "month": "July",      "date_range": "July 7-8",           "location": "Calgary, Alberta",                "page": 2, "confidence": 0.90},
    {"code": "BIC - PM",   "month": "July",      "date_range": "July 9-10",          "location": "Toronto, Ontario",                "page": 2, "confidence": 0.90},
    {"code": "EFU - VV",   "month": "July",      "date_range": "July 9-10",          "location": "Houston, Texas",                  "page": 2, "confidence": 0.90},
    {"code": "DOC - JS",   "month": "July",      "date_range": "July 9-10",          "location": "Calgary, Alberta",                "page": 2, "confidence": 0.90},
    {"code": "DLC - VV",   "month": "July",      "date_range": "July 14-15",         "location": "Calgary, Alberta",                "page": 2, "confidence": 0.90},
    {"code": "OBU - PT",   "month": "July",      "date_range": "July 14-15",         "location": "Boston, Massachusetts",           "page": 2, "confidence": 0.90},
    {"code": "WDU - JS",   "month": "July",      "date_range": "July 14-15",         "location": "Houston, Texas",                  "page": 2, "confidence": 0.90},
    {"code": "ODU - PT",   "month": "July",      "date_range": "July 16-17",         "location": "Boston, Massachusetts",           "page": 2, "confidence": 0.90},
    {"code": "OAU - VV",   "month": "July",      "date_range": "July 16-17",         "location": "Houston, Texas",                  "page": 2, "confidence": 0.90},
    {"code": "SCU - PM",   "month": "July",      "date_range": "July 21-22",         "location": "Miami, Florida",                  "page": 2, "confidence": 0.90},
    {"code": "SGC - PM",   "month": "July",      "date_range": "July 21-22",         "location": "Calgary, Alberta",                "page": 2, "confidence": 0.90},
    {"code": "DOC - JS",   "month": "July",      "date_range": "July 23-24",         "location": "Calgary, Alberta",                "page": 2, "confidence": 0.90},
    {"code": "MTU - MP",   "month": "July",      "date_range": "July 23-24",         "location": "Miami, Florida",                  "page": 2, "confidence": 0.90},
    {"code": "ALF - JS",   "month": "July",      "date_range": "July 28-29",         "location": "Houston, Texas",                  "page": 2, "confidence": 0.90},
    {"code": "PSE - MP",   "month": "July",      "date_range": "July 28-29",         "location": "Amsterdam, The Netherlands",      "page": 2, "confidence": 0.90},
    {"code": "PRB - JS",   "month": "July",      "date_range": "July 29-30",         "location": "Rio de Janeiro, Brazil",          "page": 2, "confidence": 0.90},
    {"code": "ORU - JS",   "month": "July",      "date_range": "July 30-31",         "location": "Houston, Texas",                  "page": 2, "confidence": 0.90},
    {"code": "GSE - RS",   "month": "July",      "date_range": "July 30-31",         "location": "Amsterdam, The Netherlands",      "page": 2, "confidence": 0.90},
    # ── August ────────────────────────────────────────────────────────────────
    {"code": "HAU - LN",   "month": "August",    "date_range": "August 13-14",       "location": "Orange County, California",       "page": 2, "confidence": 0.90},
    {"code": "ROU - LN",   "month": "August",    "date_range": "August 20-21",       "location": "Houston, Texas",                  "page": 2, "confidence": 0.90},
    {"code": "LMU - RS",   "month": "August",    "date_range": "August 20-21",       "location": "Detroit, Michigan",               "page": 2, "confidence": 0.90},
    {"code": "BNC - RS",   "month": "August",    "date_range": "August 25-26",       "location": "Toronto, Canada",                 "page": 2, "confidence": 0.90},
    {"code": "SFU - AD",   "month": "August",    "date_range": "August 25-26",       "location": "Orange County, California",       "page": 2, "confidence": 0.90},
    {"code": "OMU - LN",   "month": "August",    "date_range": "August 25-26",       "location": "Miami, Florida",                  "page": 2, "confidence": 0.90},
    {"code": "HFU - RS",   "month": "August",    "date_range": "August 27-28",       "location": "Anaheim, California",             "page": 2, "confidence": 0.90},
    {"code": "WRU - MP",   "month": "August",    "date_range": "August 27-28",       "location": "Miami, Florida",                  "page": 2, "confidence": 0.90},
    # ── September ─────────────────────────────────────────────────────────────
    {"code": "LMA - RS",   "month": "September", "date_range": "September 2-3",      "location": "Detroit, Michigan",               "page": 3, "confidence": 0.90},
    {"code": "EPU - RS",   "month": "September", "date_range": "September 4-5",      "location": "Detroit, Michigan",               "page": 3, "confidence": 0.90},
    {"code": "EGU - VV",   "month": "September", "date_range": "September 4-5",      "location": "Houston, Texas",                  "page": 3, "confidence": 0.90},
    {"code": "LFU - RS",   "month": "September", "date_range": "September 8-9",      "location": "Detroit, Michigan",               "page": 3, "confidence": 0.90},
    {"code": "ACU - RS",   "month": "September", "date_range": "September 8-9",      "location": "Orange County, California",       "page": 3, "confidence": 0.90},
    {"code": "DLE - VV",   "month": "September", "date_range": "September 8-9",      "location": "Munich, Germany",                 "page": 3, "confidence": 0.90},
    {"code": "WMM - JS",   "month": "September", "date_range": "September 8-9",      "location": "Dubai, UAE",                      "page": 3, "confidence": 0.90},
    {"code": "GGU - RS",   "month": "September", "date_range": "September 10-11",    "location": "Detroit, Michigan",               "page": 3, "confidence": 0.90},
    {"code": "RGU - AD",   "month": "September", "date_range": "September 10-11",    "location": "Orange County, California",       "page": 3, "confidence": 0.90},
    {"code": "EAE - RS",   "month": "September", "date_range": "September 10-11",    "location": "Munich, Germany",                 "page": 3, "confidence": 0.90},
    {"code": "PRM - JS",   "month": "September", "date_range": "September 10-11",    "location": "Dubai, UAE",                      "page": 3, "confidence": 0.90},
    {"code": "THM - LN",   "month": "September", "date_range": "September 15-16",    "location": "Dubai, UAE",                      "page": 3, "confidence": 0.90},
    {"code": "HDU - VV",   "month": "September", "date_range": "September 15-16",    "location": "Houston, Texas, USA",             "page": 3, "confidence": 0.90},
    {"code": "STE - LN",   "month": "September", "date_range": "September 15-16",    "location": "London, UK",                      "page": 3, "confidence": 0.90},
    {"code": "REF - JS",   "month": "September", "date_range": "September 17-18",    "location": "Houston, Texas, USA",             "page": 3, "confidence": 0.90},
    {"code": "SLU - VV",   "month": "September", "date_range": "September 22-23",    "location": "Houston, Texas",                  "page": 3, "confidence": 0.90},
    {"code": "SPU - VV",   "month": "September", "date_range": "September 22-23",    "location": "Anaheim, California",             "page": 3, "confidence": 0.90},
    {"code": "BTE - RS",   "month": "September", "date_range": "September 22-23",    "location": "Frankfurt, Germany",              "page": 3, "confidence": 0.90},
    {"code": "WIU - MP",   "month": "September", "date_range": "September 24-25",    "location": "Anaheim, California",             "page": 3, "confidence": 0.90},
    {"code": "MSE - RS",   "month": "September", "date_range": "September 24-25",    "location": "Frankfurt, Germany",              "page": 3, "confidence": 0.90},
    {"code": "CLF - JS",   "month": "September", "date_range": "September 29-30",    "location": "Calgary, Alberta",                "page": 3, "confidence": 0.90},
    {"code": "VPU - VV",   "month": "September", "date_range": "September 29-30",    "location": "Houston, Texas, USA",             "page": 3, "confidence": 0.90},
    {"code": "OIU - JS",   "month": "September", "date_range": "September 29-30",    "location": "Houston, Texas",                  "page": 3, "confidence": 0.90},
    {"code": "CYU - PT",   "month": "September", "date_range": "September 29-30",    "location": "Boston, Massachusetts",           "page": 3, "confidence": 0.90},
    # ── October ───────────────────────────────────────────────────────────────
    {"code": "MRU - PT",   "month": "October",   "date_range": "October 1-2",        "location": "Boston, Massachusetts",           "page": 3, "confidence": 0.90},
    {"code": "BNZ - RS",   "month": "October",   "date_range": "October 1-2",        "location": "Perth, Australia",                "page": 3, "confidence": 0.90},
    {"code": "PRZ - JS",   "month": "October",   "date_range": "October 6-7",        "location": "Perth, Australia",                "page": 3, "confidence": 0.90},
    {"code": "FCU - JS",   "month": "October",   "date_range": "October 6-7",        "location": "The Woodlands, Texas",            "page": 3, "confidence": 0.90},
    {"code": "BLU - AD",   "month": "October",   "date_range": "October 6-7",        "location": "Chicago, Illinois",               "page": 3, "confidence": 0.90},
    {"code": "BIE - PM",   "month": "October",   "date_range": "October 6-7",        "location": "Frankfurt, Germany",              "page": 3, "confidence": 0.90},
    {"code": "CCZ - VV",   "month": "October",   "date_range": "October 8-9",        "location": "Perth, Australia",                "page": 3, "confidence": 0.90},
    {"code": "AIU - AD",   "month": "October",   "date_range": "October 8-9",        "location": "The Woodlands, Texas",            "page": 3, "confidence": 0.90},
    {"code": "FZU - AD",   "month": "October",   "date_range": "October 8-9",        "location": "Chicago, Illinois",               "page": 3, "confidence": 0.90},
    {"code": "DDE - PT",   "month": "October",   "date_range": "October 8-9",        "location": "Frankfurt, Germany",              "page": 3, "confidence": 0.90},
    {"code": "SME - RS",   "month": "October",   "date_range": "October 13-14",      "location": "Amsterdam, The Netherlands",      "page": 3, "confidence": 0.90},
    {"code": "VXU - PM",   "month": "October",   "date_range": "October 13-14",      "location": "Detroit, Michigan",               "page": 3, "confidence": 0.90},
    {"code": "SDU - RS",   "month": "October",   "date_range": "October 15-16",      "location": "Detroit, Michigan",               "page": 3, "confidence": 0.90},
    {"code": "STU - LN",   "month": "October",   "date_range": "October 20-21",      "location": "Orange County, California",       "page": 3, "confidence": 0.90},
    {"code": "PSU - MP",   "month": "October",   "date_range": "October 22-23",      "location": "Orange County, California",       "page": 3, "confidence": 0.90},
    {"code": "CCU - VV",   "month": "October",   "date_range": "October 27-28",      "location": "Houston, Texas",                  "page": 3, "confidence": 0.90},
    {"code": "REE - RS",   "month": "October",   "date_range": "October 27-28",      "location": "Frankfurt, Germany",              "page": 3, "confidence": 0.90},
    {"code": "WDRM - MP",  "month": "October",   "date_range": "October 27-28",      "location": "Dubai, UAE",                      "page": 3, "confidence": 0.90},
    {"code": "BISG - PM",  "month": "October",   "date_range": "October 27-28",      "location": "Singapore",                       "page": 3, "confidence": 0.90},
    {"code": "TIE - PT",   "month": "October",   "date_range": "October 29-30",      "location": "Frankfurt, Germany",              "page": 3, "confidence": 0.90},
    {"code": "DIU - JS",   "month": "October",   "date_range": "October 29-30",      "location": "Houston, Texas",                  "page": 3, "confidence": 0.90},
    # ── November ──────────────────────────────────────────────────────────────
    {"code": "WLKU - MP",  "month": "November",  "date_range": "November 3-4",       "location": "Orange County, California",       "page": 4, "confidence": 0.90},
    {"code": "MPU - VV",   "month": "November",  "date_range": "November 3-4",       "location": "League City, Texas, USA",         "page": 4, "confidence": 0.90},
    {"code": "WSE - MP",   "month": "November",  "date_range": "November 3-4",       "location": "Amsterdam, The Netherlands",      "page": 4, "confidence": 0.90},
    {"code": "THU - LN",   "month": "November",  "date_range": "November 5-6",       "location": "Torrance, California, USA",       "page": 4, "confidence": 0.90},
    {"code": "WTTE - MP",  "month": "November",  "date_range": "November 5-6",       "location": "Amsterdam, The Netherlands",      "page": 4, "confidence": 0.90},
    {"code": "SIU - RS",   "month": "November",  "date_range": "November 11-12",     "location": "Detroit, Michigan",               "page": 4, "confidence": 0.90},
    {"code": "TLU - RS",   "month": "November",  "date_range": "November 13-14",     "location": "Detroit, Michigan",               "page": 4, "confidence": 0.90},
    {"code": "VFU - AD",   "month": "November",  "date_range": "November 17-18",     "location": "Orange County, California",       "page": 4, "confidence": 0.90},
    {"code": "PAU - AD",   "month": "November",  "date_range": "November 17-18",     "location": "Chicago, Illinois",               "page": 4, "confidence": 0.90},
    {"code": "DAU - AD",   "month": "November",  "date_range": "November 19-20",     "location": "Orange County, California",       "page": 4, "confidence": 0.90},
    {"code": "RFU - RS",   "month": "November",  "date_range": "November 19-20",     "location": "Chicago, Illinois",               "page": 4, "confidence": 0.90},
    {"code": "AVE - RS",   "month": "November",  "date_range": "November 24-25",     "location": "Frankfurt, Germany",              "page": 4, "confidence": 0.90},
    {"code": "HFE - RS",   "month": "November",  "date_range": "November 26-27",     "location": "Frankfurt, Germany",              "page": 4, "confidence": 0.90},
    # ── December ──────────────────────────────────────────────────────────────
    {"code": "DLU - VV",   "month": "December",  "date_range": "December 1-2",       "location": "Orange County, California, USA",  "page": 4, "confidence": 0.90},
    {"code": "WTTZ - MP",  "month": "December",  "date_range": "December 1-2",       "location": "Preston, Australia",              "page": 4, "confidence": 0.90},
    {"code": "SGU - PM",   "month": "December",  "date_range": "December 3-4",       "location": "Orange County, California",       "page": 4, "confidence": 0.90},
    {"code": "RSU - JS",   "month": "December",  "date_range": "December 3-4",       "location": "Houston, Texas",                  "page": 4, "confidence": 0.90},
    {"code": "BIZ - PM",   "month": "December",  "date_range": "December 3-4",       "location": "Melbourne, Australia",            "page": 4, "confidence": 0.90},
    {"code": "FAU - AD",   "month": "December",  "date_range": "December 8-9",       "location": "Orange County, California",       "page": 4, "confidence": 0.90},
    {"code": "POU - PT",   "month": "December",  "date_range": "December 8-9",       "location": "Boston, Massachusetts",           "page": 4, "confidence": 0.90},
    {"code": "SGE - PM",   "month": "December",  "date_range": "December 8-9",       "location": "Frankfurt, Germany",              "page": 4, "confidence": 0.90},
    {"code": "AFU - AD",   "month": "December",  "date_range": "December 10-11",     "location": "Orange County, California",       "page": 4, "confidence": 0.90},
    {"code": "WTTU - MP",  "month": "December",  "date_range": "December 15-16",     "location": "Orange County, California",       "page": 4, "confidence": 0.90},
    {"code": "GSTU - VV",  "month": "December",  "date_range": "December 17-18",     "location": "Orange County, California",       "page": 4, "confidence": 0.90},
]


class Historical2025PDFImporter:
    PDF_FILENAME = "2025.pdf"

    def __init__(self, pdf_path=None):
        if pdf_path is None:
            from django.conf import settings
            from pathlib import Path as _Path
            pdf_path = str(_Path(settings.BASE_DIR) / "data" / "pdfs" / self.PDF_FILENAME)
        self.pdf_path = pdf_path

    def extract(self):
        import os as _os, logging as _logging
        _log = _logging.getLogger(__name__)
        if _os.path.isfile(self.pdf_path):
            try:
                rows = self._extract_from_pdf()
                if rows:
                    return rows
            except Exception as exc:
                _log.warning("2025 PDF extraction failed (%s); using hardcoded dataset.", exc)
        else:
            _log.info("2025 PDF not found -- using hardcoded dataset.")
        return self._hardcoded_rows()

    def _extract_from_pdf(self):
        try:
            import pdfplumber
        except ImportError:
            return []
        rows = []
        month_upper = {m.upper(): m for m in [
            "January", "February", "March", "April", "May", "June",
            "July", "August", "September", "October", "November", "December",
        ]}
        current_month = None
        with pdfplumber.open(self.pdf_path) as pdf:
            for page_num, page in enumerate(pdf.pages, start=1):
                for table in (page.extract_tables() or []):
                    for row in table:
                        if not row or all(not (c or "").strip() for c in row):
                            continue
                        first = (row[0] or "").strip().upper()
                        # strip the " - XX" suffix for month detection
                        first_base = first.split(" - ")[0].strip() if " - " in first else first
                        if first_base in month_upper:
                            current_month = month_upper[first_base]
                            continue
                        if not current_month:
                            continue
                        code_raw = (row[0] or "").strip()
                        if not code_raw or len(code_raw) > 15:
                            continue
                        if code_raw.upper().split(" - ")[0].strip() in ("CODE", "EVENT", "DATES", "DATE"):
                            continue
                        rows.append({
                            "code": code_raw,
                            "month": current_month,
                            "date_range": (row[1] or "").strip() if len(row) > 1 else "",
                            "location":   (row[2] or "").strip() if len(row) > 2 else "",
                            "page": page_num,
                            "confidence": 0.70,
                        })
        return rows

    def _hardcoded_rows(self):
        return [dict(r) for r in PDF_2025_EVENTS]
