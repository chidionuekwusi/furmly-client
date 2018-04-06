import React, { Component } from "react";
import { connect } from "react-redux";
import { runDynamoProcessor } from "./actions";
import ValidationHelper, { VALIDATOR_TYPES } from "./utils/validator";
import invariants from "./utils/invariants";
import { getKey, unwrapObjectValue } from "./utils/view";
import debug from "debug";
export default (ProgressIndicator, Layout, Container) => {
	if (
		invariants.validComponent(ProgressIndicator, "ProgressIndicator") &&
		invariants.validComponent(Layout, "Layout") &&
		!Container
	)
		throw new Error("Container cannot be null (dynamo_select)");

	const log = debug("dynamo-client-components:select");

	//map elements in DynamoView props to elements in store.
	const mapStateToProps = (_, initialProps) => (state, ownProps) => {
		if (ownProps.args.type == "PROCESSOR") {
			let component_uid = getKey(state, ownProps.component_uid, ownProps);
			let st = state.dynamo.view[component_uid];
			return {
				items: st,
				busy: !!state.dynamo.view[`${ownProps.component_uid}-busy`],
				component_uid
			};
		}
		//evaluate stuff in the parent container to retrieve the
	};

	const mapDispatchToProps = dispatch => {
		return {
			fetch: (id, params, key) => {
				dispatch(runDynamoProcessor(id, params, key));
			}
		};
	};

	class DynamoSelect extends Component {
		constructor(props) {
			super(props);
			this.state = {};
			this.fetchItems = this.fetchItems.bind(this);
			this.onValueChanged = this.onValueChanged.bind(this);
			this.selectFirstItem = this.selectFirstItem.bind(this);
			this.getValueBasedOnMode = this.getValueBasedOnMode.bind(this);
			this.props.validator.validate = () => {
				return this.runValidators();
			};
			this.isValidValue = this.isValidValue.bind(this);
			this.isObjectIdMode = this.isObjectIdMode.bind(this);
		}
		hasValue() {
			return !!this.props.value || "is required";
		}
		runValidators() {
			return new ValidationHelper(this).run();
		}
		onValueChanged(value) {
			if (this._mounted) {
				this.props.valueChanged({
					[this.props.name]: this.getValueBasedOnMode(value)
				});
			}
		}
		fetchItems(source, args, component_uid) {
			if (this._mounted)
				this.props.fetch(
					source,
					JSON.parse(
						args || this.props.args.config.customArgs || "{}"
					),
					component_uid || this.props.component_uid || ""
				);
		}
		isValidValue(items = this.props.items, value = this.props.value) {
			value = unwrapObjectValue(value);
			return (
				items &&
				items.length &&
				items.filter(x => x._id == value).length
			);
		}
		getValueBasedOnMode(v) {
			return (
				(this.props.args &&
				this.props.args.mode &&
				typeof v !== "object" &&
				this.props.args.mode == "ObjectId" && { $objectID: v }) ||
				v
			);
		}
		componentWillReceiveProps(next) {
			if (
				next.args.config.value !== this.props.args.config.value ||
				(next.args.config.customArgs !==
					this.props.args.config.customArgs &&
					!this.props.busy) ||
				next.component_uid !== this.props.component_uid ||
				(next.args.config.value &&
					typeof next.items == "undefined" &&
					!next.busy)
			) {
				return this.fetchItems(
					next.args.config.value,
					next.args.config.customArgs,
					next.component_uid
				);
			}

			if (next.items && next.items.length == 1 && !next.value) {
				return this.selectFirstItem(next.items[0]._id);
			}

			if (
				(next.items &&
					next.value &&
					!this.isValidValue(next.items, next.value)) ||
				!next.items
			) {
				return this.onValueChanged(null);
			}
		}

		selectFirstItem(item) {
			setTimeout(() => {
				this.onValueChanged(item);
			}, 0);
		}
		componentWillUnmount() {
			this._mounted = false;
		}
		isObjectIdMode() {
			return this.props.args && this.props.args.mode === "ObjectId";
		}
		componentDidMount() {
			this._mounted = true;
			if (!this.props.items) {
				log(
					"fetching items in componentDidMount for current:" +
						this.props.name
				);
				this.fetchItems(this.props.args.config.value);
			}

			if (this.props.items && this.props.items.length == 1) {
				return this.selectFirstItem(this.props.items[0]._id);
			}
		}
		isEmptyOrNull(v) {
			return !v || !v.length;
		}
		render() {
			/*jshint ignore:start*/

			log(`rendering ${this.props.name}`);
			if (this.isEmptyOrNull(this.props.items)) {
				log(`${this.props.name} is empty`);
				return <ProgressIndicator />;
			}
			return (
				<Layout
					value={this.props.label}
					inner={
						<Container
							disabled={
								!!this.props.args.disabled ||
								(this.props.items &&
									this.props.items.length == 1)
							}
							errors={this.state.errors}
							label={this.props.label}
							items={this.props.items}
							displayProperty="displayLabel"
							keyProperty="_id"
							value={unwrapObjectValue(this.props.value)}
							valueChanged={this.onValueChanged}
						/>
					}
				/>
			);
			/*jshint ignore:end*/
		}
	}

	return connect(mapStateToProps, mapDispatchToProps)(DynamoSelect);
};
