import { defineStore } from "pinia";
import {
    callCreateFormSession,
    callGetFormStoryboard,
    callSubmitForm,
    callGetForm,
} from "@/api/conversation";

type ConversationStore = {
    form?: PublicFormModel;
    session?: FormSessionModel;
    storyboard: PublicFormBlockModel[] | null;
    queue: PublicFormBlockModel[] | null;
    current: number;
    payload: FormSubmitPayload;
    isProcessing: boolean;
    isSubmitted: boolean;
};

export const useConversation = defineStore("form", {
    state: (): ConversationStore => {
        return {
            form: undefined,
            session: undefined,
            storyboard: null,
            queue: null,
            current: 0,
            payload: {},
            isProcessing: false,
            isSubmitted: false,
        };
    },

    getters: {
        isFirstBlock(state): boolean {
            if (!state.queue) {
                return false;
            }

            return state.current === 0;
        },

        isLastBlock(state): boolean {
            if (!state.queue) {
                return false;
            }

            return state.current + 1 >= state.queue.length;
        },

        currentBlock: (state): PublicFormBlockModel | null => {
            if (state.queue && state.queue.length >= state.current) {
                return state.queue[state.current];
            }

            return null;
        },

        currentPayload(
            state
        ): FormBlockInteractionPayload | FormBlockInteractionPayload[] | null {
            if (!this.currentBlock) return null;

            if (state.payload[this.currentBlock.id]) {
                return state.payload[this.currentBlock.id];
            }

            return null;
        },

        currentBlockIdentifier(): string | null {
            if (!this.currentBlock) {
                return null;
            }

            return this.currentBlock.title || this.currentBlock.id;
        },
    },

    actions: {
        async initForm(initialPayload: string | PublicFormModel) {
            const id =
                typeof initialPayload === "string"
                    ? initialPayload
                    : initialPayload.uuid;

            if (typeof initialPayload !== "string") {
                this.form = initialPayload as PublicFormModel;
            } else {
                const response = await callGetForm(id);
                this.form = response.data;
            }

            const storyboardResponse = await callGetFormStoryboard(id);
            const formSessionResponse = await callCreateFormSession(id);

            this.session = formSessionResponse.data;
            this.storyboard = storyboardResponse.data.blocks;
            this.queue = storyboardResponse.data.blocks;
        },

        setResponse(
            action: PublicFormBlockInteractionModel,
            value: string | boolean | null
        ) {
            if (!this.currentBlock) return;

            this.payload[this.currentBlock.id] = {
                payload: value,
                actionId: action.id,
            };
        },

        toggleResponse(
            action: PublicFormBlockInteractionModel,
            value: string | boolean | null
        ) {
            if (!this.currentBlock) return;

            const givenPayload = {
                payload: value,
                actionId: action.id,
            };
            const currentPayload = this.payload[this.currentBlock.id];

            if (!Array.isArray(currentPayload)) {
                this.payload[this.currentBlock.id] = [givenPayload];
            } else {
                const foundIndex = currentPayload.findIndex(
                    (p) => p.actionId === action.id
                );

                foundIndex === -1
                    ? currentPayload.push(givenPayload)
                    : currentPayload.splice(foundIndex, 1);
            }
        },

        back() {
            if (this.isFirstBlock) {
                return;
            }

            this.current -= 1;
        },

        /**
         * Increases current block by one or submits form if last block is triggered.
         * @returns {Promise<boolean>}
         */
        async next(): Promise<boolean> {
            if (this.isLastBlock) {
                this.isProcessing = true;

                if (this.form?.uuid && this.session?.token) {
                    await callSubmitForm(
                        this.form.uuid,
                        this.session.token,
                        this.payload
                    );

                    this.isSubmitted = true;
                    this.isProcessing = false;

                    return Promise.resolve(true);
                } else {
                    this.isProcessing = false;
                    return Promise.reject(new Error("Form or session not set"));
                }
            } else {
                this.current += 1;
                return Promise.resolve(false);
            }
        },
    },
});
